git commit -am "$1"
git push
rm -rf ./out/*
npm run build
cd out
git add *
git commit -am "$1"
git push -f

