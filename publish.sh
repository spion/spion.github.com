git commit -am "$1"
git push
rm -rf ./out/*
docpad generate
cd out
git add *
git commit -am "$1"
git push -f

