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
                primary: "#FF5F1F", // Neon Orange
                secondary: "#FF8C00", // Dark Orange
                background: "#0a0a0a", // Battle Black
                surface: "#121212", // Surface Black
                darkGray: "#2a2a2a",
                textPrimary: "#FFFFFF",
                textSecondary: "#A0A0A0",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "system-ui", "sans-serif"],
                display: ["var(--font-syne)", "system-ui", "sans-serif"],
            },
            animation: {
                'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'gradient-x': 'gradient-x 15s ease infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 5px #FF5F1F' },
                    '100%': { boxShadow: '0 0 20px #FF5F1F, 0 0 10px #FF5F1F' },
                },
                'gradient-x': {
                    '0%, 100%': {
                        'background-size': '200% 200%',
                        'background-position': 'left center'
                    },
                    '50%': {
                        'background-size': '200% 200%',
                        'background-position': 'right center'
                    },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                }
            },
            boxShadow: {
                'neon': '0 0 10px rgba(255, 95, 31, 0.2)',
                'glass': 'inset 0 0 20px rgba(255, 255, 255, 0.05)',
            }
        },
    },
    plugins: [],
};

export default config;
