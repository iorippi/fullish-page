# Fullish-Page

Responsive FullPage plugin (for GSAP)


## Use case

Fullish-Page is a responsive carousel plugin.
This combines a few unconventional combination:

1. Automatically sets up Full-page carousel ONLY WHEN the panels fits within the viewport.
2. Allows Full-page applied only partially to one or more sections in page to retain normal static flow for other parts.
3. Much of codebase relies on GSAP (Also GSAP ScrollTrigger), resulting in very lightweight addition if you already use GSAP to your project.

Note that if any of the above is not desirable to you, there are numerous conventional plugin and solutions provided there. This plugin is aimed to solve the specific edge case solution.

Here's a few other merits


## How to use

1. Load following plugins  
  - [GSAP core](https://cdnjs.cloudflare.com/ajax/libs/gsap/3.10.4/gsap.min.js)
  - [GSAP ScrollTrigger](https://cdnjs.cloudflare.com/ajax/libs/gsap/3.10.4/ScrollTrigger.min.js)
	- Fullish-Page.js

2. Execute following code

```
const fp = new FullPage({config}); 
fp.init();
```


## Sources
### GSAP
- [Green Sock official website](https://greensock.com/)
- [GSAP ScrollTrigger Documentation](https://greensock.com/docs/v3/Plugins/ScrollTrigger)

2022 Iori Tatsuguchi
