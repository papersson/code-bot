import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			'main-background': 'hsl(var(--main-background))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			button: {
  				DEFAULT: '#3E6FCA',
  				hover: '#345DB0',
  			},
  			chat: {
  				user: {
  					DEFAULT: 'hsl(150 15% 50%)',
  					foreground: 'hsl(150 10% 98%)',
  					icon: 'hsl(150 20% 45%)',
  					background: 'hsl(150 20% 97%)',
  				},
  				bot: {
  					DEFAULT: 'hsl(var(--background))',
  					foreground: 'hsl(var(--foreground))',
  				}
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: '0.75rem',
  			md: '0.5rem',
  			sm: '0.25rem'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
        'loading-dot': {
          '0%': {
            opacity: '0.2',
          },
          '20%': {
            opacity: '1',
            transform: 'translateY(-1px)',
          },
          '100%': {
            opacity: '0.2',
            transform: 'translateY(0)',
          },
        }
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		typography: {
  			DEFAULT: {
  				css: {
  					maxWidth: 'none',
  					color: 'hsl(var(--foreground))',
  					p: {
  						marginTop: '1em',
  						marginBottom: '1em',
  					},
  					ul: {
              listStyleType: 'disc',
              marginTop: '1em',
              marginBottom: '1em',
            },
            ol: {
              listStyleType: 'decimal',
              marginTop: '1em',
              marginBottom: '1em',
            },
  					'ul > li': {
  						position: 'relative',
              marginTop: '0.5em',
              marginBottom: '0.5em',
  					},
  					'ol > li': {
  						position: 'relative',
              marginTop: '0.5em',
              marginBottom: '0.5em',
  					},
  					code: {
  						color: 'hsl(var(--foreground))',
  						backgroundColor: 'hsl(var(--muted))',
  						borderRadius: '0.25rem',
  						padding: '0.2em 0.4em',
  					},
  					pre: {
  						backgroundColor: 'hsl(var(--muted))',
  						color: 'hsl(var(--foreground))',
  					},
  				},
  			},
  		},
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography")
  ],
} satisfies Config;
