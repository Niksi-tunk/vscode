/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./media/*.eta"],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: [
      {
        mytheme: {
          "primary": "#0683d7",
          "secondary": "#8d3fd0",
          "accent": "#ed3d63",
          "neutral": "#51829b",
          "base-100": "#272829",
          "info": "lightblue",
          "success": "lightgreen",
          "warning": "orange",
          "error": "#ff0000",
        },
      },
    ],
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
}

