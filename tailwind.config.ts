import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#FF9500", // Amber
                secondary: "#FFB84D", // Light amber
                background: "#0F0F0F", // Matte black
                surface: "#1A1A1A", // Slightly lighter black
                darkGray: "#333333",
                textPrimary: "#FFFFFF",
                textSecondary: "#AAAAAA",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [],
};

export default config;
