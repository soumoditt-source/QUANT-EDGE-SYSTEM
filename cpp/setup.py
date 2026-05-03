"""
QuantEdge C++ Microstructure Engine - Build Script
====================================================
Compiles quant_engine.cpp into a Python extension module using pybind11.

Usage (from the /cpp directory):
    pip install pybind11
    python setup.py build_ext --inplace

The compiled .pyd (Windows) or .so (Linux/Mac) file will be placed in this
directory and then imported by the Python bridge.

For Render cloud deployment, this compiles automatically via the render.yaml
build command.
"""

from setuptools import setup, Extension
import pybind11

ext = Extension(
    name="quant_engine",
    sources=["quant_engine.cpp"],
    include_dirs=[pybind11.get_include()],
    language="c++",
    extra_compile_args=[
        "/std:c++17",    # MSVC (Windows)
        "/O2",           # Full optimisation
        "/W3",           # Warnings level 3
    ] if __import__("sys").platform == "win32" else [
        "-std=c++17",    # GCC/Clang (Linux/Mac - Render)
        "-O3",
        "-march=native",
        "-ffast-math",
        "-Wall",
    ],
)

setup(
    name="quant_engine",
    version="1.0.0",
    description="QuantEdge High-Performance Microstructure Engine (C++17 + pybind11)",
    ext_modules=[ext],
    python_requires=">=3.10",
)
