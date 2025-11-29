set -l color_pairs 'lightestgray:midground-faintest' 'lightergray:midground-fainter' 'lightgray:midground-faint' 'light:background' 'gray:midground' 'darkgray:midground-strong' 'dark:foreground'

for pair in $color_pairs
    set -l before_color (string split ':' $pair)[1]
    set -l after_color (string split ':' $pair)[2]
    sed -i".bak" "s|--$before_color|--$after_color|g" ./quartz/**/*.scss
    sed -i".bak" "s|--$before_color|--$after_color|g" ./content/**.md
end
