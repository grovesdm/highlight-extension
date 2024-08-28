#!/bin/bash

# Colors array
colors=("blue" "green" "red" "yellow")

# Sizes array
sizes=(16 48 128)

# Generate colored icons
for color in "${colors[@]}"; do
    for size in "${sizes[@]}"; do
        magick "${color}.png" -resize ${size}x${size} "icon_${color}_${size}.png"
    done
done

# Generate grey (off) icons
for size in "${sizes[@]}"; do
    magick yellow.png -resize ${size}x${size} -colorspace gray "icon_grey_${size}.png"
done

echo "Icon generation complete!"