#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/artifacts/project-intro-video"
SLIDE_DIR="$ARTIFACT_DIR/slides"
WORK_DIR="$ARTIFACT_DIR/work"
AUDIO_FILE="$ARTIFACT_DIR/audio/narration-120s.m4a"
SUBTITLES_FILE="$ARTIFACT_DIR/subtitles.srt"
OUTPUT_FILE="$ARTIFACT_DIR/ArcPredict-project-intro-2min.mp4"

mkdir -p "$WORK_DIR"
rm -f "$WORK_DIR"/scene-*.mp4 "$WORK_DIR/concat.txt" "$WORK_DIR/silent.mp4"

make_scene() {
  local src="$1"
  local duration="$2"
  local output="$3"

  ffmpeg -y \
    -loop 1 \
    -t "$duration" \
    -i "$src" \
    -vf "scale=1280:720,fade=t=in:st=0:d=0.35,fade=t=out:st=$(awk "BEGIN { print $duration - 0.35 }"):d=0.35,format=yuv420p" \
    -r 30 \
    -an \
    -c:v libx264 \
    -preset veryfast \
    -crf 18 \
    "$output"
}

make_scene "$SLIDE_DIR/slide-00.png" 14 "$WORK_DIR/scene-00.mp4"
make_scene "$SLIDE_DIR/slide-01.png" 18 "$WORK_DIR/scene-01.mp4"
make_scene "$SLIDE_DIR/slide-02.png" 20 "$WORK_DIR/scene-02.mp4"
make_scene "$SLIDE_DIR/slide-03.png" 20 "$WORK_DIR/scene-03.mp4"
make_scene "$SLIDE_DIR/slide-04.png" 21 "$WORK_DIR/scene-04.mp4"
make_scene "$SLIDE_DIR/slide-05.png" 17 "$WORK_DIR/scene-05.mp4"
make_scene "$SLIDE_DIR/slide-06.png" 10 "$WORK_DIR/scene-06.mp4"

for scene in "$WORK_DIR"/scene-*.mp4; do
  printf "file '%s'\n" "$scene" >> "$WORK_DIR/concat.txt"
done

ffmpeg -y \
  -f concat \
  -safe 0 \
  -i "$WORK_DIR/concat.txt" \
  -c copy \
  "$WORK_DIR/silent.mp4"

ffmpeg -y \
  -i "$WORK_DIR/silent.mp4" \
  -i "$AUDIO_FILE" \
  -i "$SUBTITLES_FILE" \
  -map 0:v:0 \
  -map 1:a:0 \
  -map 2:s:0 \
  -c:v libx264 \
  -preset medium \
  -crf 18 \
  -c:a copy \
  -c:s mov_text \
  -metadata:s:s:0 language=eng \
  -shortest \
  -movflags +faststart \
  "$OUTPUT_FILE"

echo "$OUTPUT_FILE"
