#!/bin/bash

cd http_server
./gradlew build

cd ..
cp http_server/build/mods/fi.abo.kogni.soile~http-server~1.1 prod/mods -r
