/**
 * QuantEdge C++ Microstructure Engine
 * ====================================
 * Implements the core quantitative signal algorithms in optimized C++17.
 * Exposed to Python via pybind11 as the `quant_engine` module.
 *
 * Algorithms Implemented:
 *   1. OBI  - Order Book Imbalance (EMA-smoothed)
 *   2. VPIN - Volume-Synchronized Probability of Informed Trading
 *   3. VWAP - Volume-Weighted Average Price Deviation (Z-score)
 *   4. MCS  - Microstructure Confidence Score (Shannon Entropy)
 *   5. LRDE - Liquidity Regime Detection Engine (Online K-Means, 5D feature vector)
 *
 * Build Command (Windows, requires pybind11 and a C++17 compiler):
 *   pip install pybind11
 *   python setup.py build_ext --inplace
 *
 * Author: QuantEdge Architecture
 */

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/numpy.h>

#include <vector>
#include <deque>
#include <cmath>
#include <algorithm>
#include <numeric>
#include <array>
#include <stdexcept>
#include <string>

namespace py = pybind11;

// ============================================================
// UTILITY
// ============================================================

static inline double clamp(double v, double lo, double hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

static double ema_update(double prev, double new_val, double alpha) {
    return alpha * new_val + (1.0 - alpha) * prev;
}

// ============================================================
// 1. ORDER BOOK IMBALANCE (OBI)
// ============================================================

class OBIEngine {
public:
    /**
     * @param depth  Number of price levels to consider from each side
     * @param ema_span  Half-life of the exponential moving average smoother
     *
     * Formula:
     *   raw_obi = (bid_vol - ask_vol) / (bid_vol + ask_vol)
     *   obi_ema[t] = alpha * raw_obi + (1 - alpha) * obi_ema[t-1]
     *   where alpha = 2 / (span + 1)
     */
    OBIEngine(int depth = 5, int ema_span = 10)
        : depth_(depth),
          alpha_(2.0 / (ema_span + 1.0)),
          current_ema_(0.0),
          initialized_(false) {}

    // bids / asks are vectors of [price, qty] pairs
    double update_book(const std::vector<std::pair<double, double>>& bids,
                       const std::vector<std::pair<double, double>>& asks) {
        double bid_vol = 0.0, ask_vol = 0.0;
        int bid_levels = std::min((int)bids.size(), depth_);
        int ask_levels = std::min((int)asks.size(), depth_);

        for (int i = 0; i < bid_levels; ++i) bid_vol += bids[i].second;
        for (int i = 0; i < ask_levels; ++i) ask_vol += asks[i].second;

        double total = bid_vol + ask_vol;
        if (total < 1e-12) return current_ema_;

        double raw_obi = (bid_vol - ask_vol) / total;

        if (!initialized_) {
            current_ema_ = raw_obi;
            initialized_ = true;
        } else {
            current_ema_ = ema_update(current_ema_, raw_obi, alpha_);
        }

        return clamp(current_ema_, -1.0, 1.0);
    }

    double get_current() const { return current_ema_; }
    void reset() { current_ema_ = 0.0; initialized_ = false; }

private:
    int depth_;
    double alpha_;
    double current_ema_;
    bool initialized_;
};

// ============================================================
// 2. VPIN ENGINE
// ============================================================

class VPINEngine {
public:
    /**
     * Volume-Synchronized Probability of Informed Trading
     *
     * Algorithm:
     *   - Accumulate ticks into volume buckets of size V_bucket
     *   - Each bucket records |buy_vol - sell_vol|
     *   - VPIN = SUM(bucket_imbalances) / (N_buckets * V_bucket)
     *   - Normalize to [-1, 1]: signal = -clip((VPIN - baseline) / 0.2)
     *     Negative because high VPIN = toxic = bearish signal
     *
     * @param bucket_volume  Volume required to close a bucket
     * @param num_buckets    Rolling window of closed buckets
     */
    VPINEngine(double bucket_volume = 10.0, int num_buckets = 50)
        : bucket_volume_(bucket_volume),
          num_buckets_(num_buckets),
          buy_volume_(0.0),
          sell_volume_(0.0),
          current_bucket_vol_(0.0),
          current_signal_(0.0),
          baseline_vpin_(0.5) {}

    // is_buyer_maker: true if the maker side of the trade was the buyer (so taker is seller)
    double update_tick(double volume, bool is_buyer_maker) {
        if (is_buyer_maker) {
            sell_volume_ += volume;  // taker is seller
        } else {
            buy_volume_ += volume;   // taker is buyer
        }
        current_bucket_vol_ += volume;

        if (current_bucket_vol_ >= bucket_volume_) {
            double imbalance = std::abs(buy_volume_ - sell_volume_);
            buckets_.push_back(imbalance);
            if ((int)buckets_.size() > num_buckets_) {
                buckets_.pop_front();
            }

            // Reset bucket accumulators
            buy_volume_ = 0.0;
            sell_volume_ = 0.0;
            current_bucket_vol_ = 0.0;

            // Only compute when we have a full window
            if ((int)buckets_.size() == num_buckets_) {
                double sum = 0.0;
                for (double b : buckets_) sum += b;
                double vpin = sum / (num_buckets_ * bucket_volume_);
                // Normalize: high VPIN => toxic flow => negative signal
                current_signal_ = -clamp((vpin - baseline_vpin_) / 0.2, -1.0, 1.0);
            }
        }
        return current_signal_;
    }

    double get_current() const { return current_signal_; }
    void reset() {
        buy_volume_ = sell_volume_ = current_bucket_vol_ = current_signal_ = 0.0;
        buckets_.clear();
    }

private:
    double bucket_volume_;
    int num_buckets_;
    double buy_volume_;
    double sell_volume_;
    double current_bucket_vol_;
    double current_signal_;
    double baseline_vpin_;
    std::deque<double> buckets_;
};

// ============================================================
// 3. VWAP DEVIATION ENGINE
// ============================================================

class VWAPEngine {
public:
    /**
     * VWAP Deviation (Z-score normalized)
     *
     * Formula:
     *   vwap = SUM(price_i * vol_i) / SUM(vol_i)
     *   std  = stddev(prices)
     *   z    = (latest_price - vwap) / std
     *   signal = -clip(z / z_threshold, -1, 1)
     *   Negative because price above VWAP suggests mean reversion (sell)
     *
     * @param window_size   Rolling window of ticks
     * @param z_threshold   Z-score at which signal saturates to +/-1
     */
    VWAPEngine(int window_size = 100, double z_threshold = 2.0)
        : window_size_(window_size),
          z_threshold_(z_threshold),
          current_signal_(0.0) {}

    double update_tick(double price, double volume) {
        prices_.push_back(price);
        volumes_.push_back(volume);
        if ((int)prices_.size() > window_size_) {
            prices_.pop_front();
            volumes_.pop_front();
        }

        if ((int)prices_.size() < 10) return 0.0;

        // VWAP
        double sum_pv = 0.0, sum_v = 0.0;
        auto pit = prices_.begin();
        auto vit = volumes_.begin();
        while (pit != prices_.end()) {
            sum_pv += (*pit) * (*vit);
            sum_v  += (*vit);
            ++pit; ++vit;
        }
        if (sum_v < 1e-12) return current_signal_;
        double vwap = sum_pv / sum_v;

        // Std dev of prices
        double mean_p = 0.0;
        for (double p : prices_) mean_p += p;
        mean_p /= prices_.size();

        double var = 0.0;
        for (double p : prices_) {
            double d = p - mean_p;
            var += d * d;
        }
        double std_dev = std::sqrt(var / prices_.size());

        if (std_dev < 1e-12) return current_signal_;

        double deviation = (price - vwap) / std_dev;
        current_signal_ = -clamp(deviation / z_threshold_, -1.0, 1.0);
        return current_signal_;
    }

    double get_current() const { return current_signal_; }
    void reset() { prices_.clear(); volumes_.clear(); current_signal_ = 0.0; }

private:
    int window_size_;
    double z_threshold_;
    double current_signal_;
    std::deque<double> prices_;
    std::deque<double> volumes_;
};

// ============================================================
// 4. MICROSTRUCTURE CONFIDENCE SCORE (MCS)
// ============================================================

class MCSEngine {
public:
    /**
     * Shannon Entropy-based Confidence Score
     *
     * Formula:
     *   H = -SUM(p_i * ln(p_i))  over 3 regime probabilities
     *   H_max = ln(3) for 3 classes
     *   MCS = 1 - (H / H_max)
     *
     * High MCS => market is clearly in one regime => signals are trustworthy
     * Low MCS  => uncertain => risk management should widen stops
     *
     * @param window_size   Window of probability snapshots to average before computing
     */
    MCSEngine(int window_size = 50)
        : window_size_(window_size),
          current_score_(1.0) {}

    double update(const std::vector<double>& regime_probs) {
        if (regime_probs.size() < 2) return current_score_;

        // Clip and normalize
        std::vector<double> p(regime_probs);
        for (auto& v : p) v = std::max(v, 1e-9);
        double s = std::accumulate(p.begin(), p.end(), 0.0);
        for (auto& v : p) v /= s;

        prob_history_.push_back(p);
        if ((int)prob_history_.size() > window_size_) {
            prob_history_.pop_front();
        }

        if ((int)prob_history_.size() < 10) return current_score_;

        // Average over window
        int n = p.size();
        std::vector<double> avg(n, 0.0);
        for (auto& row : prob_history_) {
            for (int i = 0; i < n; ++i) avg[i] += row[i];
        }
        for (auto& v : avg) v /= prob_history_.size();

        // Shannon entropy
        double entropy = 0.0;
        for (double v : avg) {
            if (v > 1e-12) entropy -= v * std::log(v);
        }
        double max_entropy = std::log((double)n);
        double normalized = (max_entropy > 1e-12) ? entropy / max_entropy : 0.0;

        current_score_ = 1.0 - normalized;
        return current_score_;
    }

    double get_current() const { return current_score_; }
    void reset() { prob_history_.clear(); current_score_ = 1.0; }

private:
    int window_size_;
    double current_score_;
    std::deque<std::vector<double>> prob_history_;
};

// ============================================================
// 5. LRDE - LIQUIDITY REGIME DETECTION ENGINE
// ============================================================

class LRDEEngine {
public:
    /**
     * Online K-Means Liquidity Regime Classifier (3 regimes, 5D feature space)
     *
     * Feature Vector: [OBI, spread_z, VPIN_magnitude, depth_stability, flow_persistence]
     *
     * Regimes:
     *   0 = MEAN-REVERTING  (tight spread, balanced book)
     *   1 = TRENDING        (directional OBI, wide spread, high flow)
     *   2 = TOXIC           (exploding spread, high VPIN, depth vanishing)
     *
     * Algorithm:
     *   - Compute Euclidean distance to all 3 centroids
     *   - Softmax(-distances) => regime probability distribution
     *   - Hysteresis: only switch regime after 3 consecutive ticks agree
     *     AND winning probability > 0.65
     *   - Winning centroid updated via EMA: c = alpha*c + (1-alpha)*x
     *
     * @param alpha  Centroid EMA decay (0.99 = slow adaptation, sticky regimes)
     */
    LRDEEngine(double alpha = 0.99) : alpha_(alpha), current_regime_(0) {
        // Seed centroids: [OBI, spread_z, VPIN_mag, depth_stability, flow_persistence]
        centroids_[0] = {0.0, 0.0, 0.0, 1.0, 0.0};  // Mean-reverting
        centroids_[1] = {0.8, 1.0, 0.2, 0.5, 0.8};  // Trending
        centroids_[2] = {0.5, 3.0, 0.8, 0.1, 0.5};  // Toxic
        regime_probs_ = {1.0, 0.0, 0.0};
    }

    // Returns {regime_id, [p_mr, p_trend, p_toxic]}
    std::pair<int, std::vector<double>> update(const std::vector<double>& features) {
        if (features.size() != 5) {
            throw std::invalid_argument("LRDE expects exactly 5 features.");
        }

        // Euclidean distances to centroids
        std::array<double, 3> distances;
        for (int k = 0; k < 3; ++k) {
            double dist2 = 0.0;
            for (int j = 0; j < 5; ++j) {
                double d = centroids_[k][j] - features[j];
                dist2 += d * d;
            }
            distances[k] = std::sqrt(dist2);
        }

        // Softmax(-distances) for probabilities
        std::array<double, 3> exp_d;
        for (int k = 0; k < 3; ++k) exp_d[k] = std::exp(-distances[k]);
        double sum_exp = exp_d[0] + exp_d[1] + exp_d[2];
        for (int k = 0; k < 3; ++k) regime_probs_[k] = exp_d[k] / sum_exp;

        // Raw assignment (argmax)
        int raw = 0;
        for (int k = 1; k < 3; ++k) {
            if (regime_probs_[k] > regime_probs_[raw]) raw = k;
        }

        // Hysteresis buffer
        recent_assignments_.push_back(raw);
        if ((int)recent_assignments_.size() > 3) recent_assignments_.pop_front();

        if ((int)recent_assignments_.size() == 3) {
            bool all_same = (recent_assignments_[0] == recent_assignments_[1] &&
                             recent_assignments_[1] == recent_assignments_[2]);
            if (all_same && regime_probs_[raw] > 0.65) {
                current_regime_ = raw;
                // EMA update winning centroid
                for (int j = 0; j < 5; ++j) {
                    centroids_[current_regime_][j] =
                        alpha_ * centroids_[current_regime_][j] + (1.0 - alpha_) * features[j];
                }
            }
        }

        return {current_regime_, regime_probs_};
    }

    int get_regime() const { return current_regime_; }
    std::vector<double> get_probs() const { return regime_probs_; }

    void reset() {
        current_regime_ = 0;
        regime_probs_ = {1.0, 0.0, 0.0};
        recent_assignments_.clear();
        centroids_[0] = {0.0, 0.0, 0.0, 1.0, 0.0};
        centroids_[1] = {0.8, 1.0, 0.2, 0.5, 0.8};
        centroids_[2] = {0.5, 3.0, 0.8, 0.1, 0.5};
    }

private:
    double alpha_;
    int current_regime_;
    std::array<std::array<double, 5>, 3> centroids_;
    std::vector<double> regime_probs_  = {1.0, 0.0, 0.0};
    std::deque<int> recent_assignments_;
};

// ============================================================
// PYBIND11 MODULE DEFINITION
// ============================================================

PYBIND11_MODULE(quant_engine, m) {
    m.doc() = R"doc(
        QuantEdge C++ Microstructure Engine
        ------------------------------------
        High-performance C++ implementations of:
          - OBIEngine    : Order Book Imbalance with EMA smoothing
          - VPINEngine   : Volume-Synchronized Probability of Informed Trading
          - VWAPEngine   : VWAP Deviation (Z-score normalized)
          - MCSEngine    : Microstructure Confidence Score (Shannon Entropy)
          - LRDEEngine   : Liquidity Regime Detection Engine (Online K-Means, 5D)
    )doc";

    py::class_<OBIEngine>(m, "OBIEngine")
        .def(py::init<int, int>(), py::arg("depth") = 5, py::arg("ema_span") = 10,
             "Initialize OBI engine. depth=price levels, ema_span=smoothing half-life.")
        .def("update_book", &OBIEngine::update_book,
             py::arg("bids"), py::arg("asks"),
             "Update with new order book snapshot. Returns EMA-smoothed OBI in [-1, 1].")
        .def("get_current", &OBIEngine::get_current, "Return last computed OBI value.")
        .def("reset", &OBIEngine::reset, "Reset internal state.");

    py::class_<VPINEngine>(m, "VPINEngine")
        .def(py::init<double, int>(),
             py::arg("bucket_volume") = 10.0, py::arg("num_buckets") = 50,
             "Initialize VPIN engine. bucket_volume=volume per bucket, num_buckets=rolling window.")
        .def("update_tick", &VPINEngine::update_tick,
             py::arg("volume"), py::arg("is_buyer_maker"),
             "Feed a single trade tick. Returns VPIN signal in [-1, 1]. Negative = toxic flow.")
        .def("get_current", &VPINEngine::get_current, "Return last computed VPIN signal.")
        .def("reset", &VPINEngine::reset, "Reset internal state.");

    py::class_<VWAPEngine>(m, "VWAPEngine")
        .def(py::init<int, double>(),
             py::arg("window_size") = 100, py::arg("z_threshold") = 2.0,
             "Initialize VWAP engine. window_size=tick window, z_threshold=saturation z-score.")
        .def("update_tick", &VWAPEngine::update_tick,
             py::arg("price"), py::arg("volume"),
             "Feed a price/volume tick. Returns VWAP deviation signal in [-1, 1].")
        .def("get_current", &VWAPEngine::get_current, "Return last computed VWAP signal.")
        .def("reset", &VWAPEngine::reset, "Reset internal state.");

    py::class_<MCSEngine>(m, "MCSEngine")
        .def(py::init<int>(), py::arg("window_size") = 50,
             "Initialize MCS engine. window_size=probability snapshot window.")
        .def("update", &MCSEngine::update,
             py::arg("regime_probs"),
             "Update with a new regime probability vector. Returns confidence score in [0, 1].")
        .def("get_current", &MCSEngine::get_current, "Return last confidence score.")
        .def("reset", &MCSEngine::reset, "Reset internal state.");

    py::class_<LRDEEngine>(m, "LRDEEngine")
        .def(py::init<double>(), py::arg("alpha") = 0.99,
             "Initialize LRDE. alpha=centroid EMA decay (0.99 = slow).")
        .def("update", &LRDEEngine::update,
             py::arg("features"),
             R"doc(
                Update with a 5D feature vector:
                [obi, spread_z, vpin_magnitude, depth_stability, flow_persistence]
                Returns (regime_id, [p_mr, p_trend, p_toxic])
             )doc")
        .def("get_regime", &LRDEEngine::get_regime, "Return current regime index (0=MR, 1=TREND, 2=TOXIC).")
        .def("get_probs", &LRDEEngine::get_probs, "Return current [p_mr, p_trend, p_toxic] vector.")
        .def("reset", &LRDEEngine::reset, "Reset to initial seeded state.");
}
