# Git + Vercel setup

You only need your existing Git provider account and a Vercel account. The game does not need a database, API keys, environment variables, or additional services.

## 1. Test the game locally

Install Node.js 22 or newer, extract the archive, and open a terminal inside the extracted `Infinite-Breaker-Supreme-v2.2` folder.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. Stop the local server with `Ctrl+C`.

## 2. Create the Git repository

Create a new empty repository named `infinite-breaker` on GitHub. Do not add a README or `.gitignore` on GitHub because they are already included in the archive.

Run these commands inside the extracted project folder:

```bash
git init
git add .
git commit -m "Release Infinite Breaker Supreme Edition v2.2"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/infinite-breaker.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

## 3. Publish on Vercel

1. In Vercel, choose **Add New → Project**.
2. Import the `infinite-breaker` GitHub repository.
3. Vercel should detect **Next.js** automatically.
4. Leave **Root Directory** as the repository root.
5. No environment variables are required.
6. Choose **Deploy**.

The included `vercel.json` selects the correct production build. Vercel will give the game a free `*.vercel.app` address.

## 4. Publish later updates

After changing the project locally:

```bash
git add .
git commit -m "Describe the update"
git push
```

Every push to `main` automatically creates a new production deployment on Vercel.

## Useful commands

```bash
npm run dev      # local development
npm run lint     # code checks
npm run build    # production build test
```

## Local saves

Campaign progress, high scores, settings, and statistics are stored in each player's browser. Clearing browser site data removes them, and they do not synchronize between devices.
