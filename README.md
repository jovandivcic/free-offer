# Jovan Divčić | Web partner for health businesses

Portfolio landing page. Static site: plain HTML, CSS and JavaScript, no build step and no dependencies.

## Structure

```
index.html        the page
css/style.css     all styles (fonts are self-hosted from assets/fonts)
js/main.js        pinned "Recent work" scroll and the "Hi, I am Jovan" scroll reel
assets/img/       images
assets/fonts/     Midnight Company, National Currency, Geist Mono
.nojekyll         tells GitHub Pages to serve the files as they are
```

All paths are relative, so the site works both at `https://<user>.github.io/<repo>/` and on a custom domain.

## Publish with GitHub Pages

1. Create a new repository on github.com (for example `portfolio`). Do not add a README there.
2. In a terminal, from this folder:

   ```
   git init
   git add .
   git commit -m "Portfolio landing page"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

   Or, without a terminal: open the new repository on github.com, choose "uploading an existing file" and drag in everything from this folder, including the `.nojekyll` file.
3. In the repository: Settings > Pages > Build and deployment > Source "Deploy from a branch", Branch `main`, folder `/ (root)`, Save.
4. After about a minute the site is live at `https://<user>.github.io/<repo>/`.

## Local preview

Open `index.html` in a browser, or run `python3 -m http.server` in this folder and open http://localhost:8000.
