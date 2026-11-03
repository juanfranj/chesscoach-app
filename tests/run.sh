#!/bin/sh
# Unit tests for the website JS (no dependencies): sh tests/run.sh
exec node --test "$(dirname "$0")"/*.test.mjs
