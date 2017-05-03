#!/bin/sh

PORT=8888
echo "Starting perf-reftest server on http://localhost:$PORT/run.html"
python -m SimpleHTTPServer $PORT >/dev/null 2>&1
