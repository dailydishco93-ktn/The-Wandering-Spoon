<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Wandering Spoon 漫游勺

A premium home kitchen web application built with React, TypeScript, and Tailwind CSS, featuring AI-powered interactions.

## Features
- **Menu Display**: Interactive weekly menu with detailed descriptions.
- **AI Integration**: Chef's Note generation and Concierge Chat using Google Gemini.
- **Dynamic Cart**: Shopping cart with daily grouping.
- **Dual Language**: English and Mandarin Chinese support.
- **Responsive Design**: Mobile-first approach using Tailwind CSS.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **AI**: Google Generative AI SDK (Gemini)

## Run Locally

**Prerequisites:** Node.js 20+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env.local` file in the root directory (refer to `.env.example`).
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_GOOGLE_SHEETS_SCRIPT_URL=your_script_url
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

## Deployment

### GitHub Pages
This repository is configured with a GitHub Action to automatically deploy to GitHub Pages on pushes to the `main` branch.

1. **Configure Secrets**:
   Go to **Settings > Secrets and variables > Actions** in your GitHub repository and add:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_SHEETS_SCRIPT_URL`

2. **Enable GitHub Pages**:
   Go to **Settings > Pages**.
   Under **Build and deployment**, select **GitHub Actions** as the source.

3. **Deploy**:
   Push changes to `main` to trigger the deployment.

## Project Structure
- `src/`: Source code
  - `App.tsx`: Main application component
  - `services/`: API services (Gemini AI)
  - `constants.ts`: Static data (Menu items, texts)
  - `types.ts`: TypeScript definitions
- `public/`: Static assets

