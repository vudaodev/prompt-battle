import puppeteer from 'puppeteer';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport to 1440x900
  await page.setViewport({ width: 1440, height: 900 });
  
  // Navigate to the app
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2' });
  
  // Wait a moment for the page to settle
  await delay(1000);
  
  // Check if we're on a landing page and need to click a button
  const startButton = await page.$('button.primary');
  if (startButton) {
    const text = await page.evaluate(btn => btn.textContent, startButton);
    if (text.includes('Start') || text.includes('Play') || text.includes('Enter')) {
      console.log('Found and clicking:', text);
      await startButton.click();
      await delay(500);
    }
  }
  
  // Now measure the layout
  const measurements = await page.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const grid = document.querySelector('.grid');
    const panels = document.querySelectorAll('.panel');
    
    const getRect = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    };
    
    const result = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      toolbar: getRect(toolbar),
      grid: getRect(grid),
      panels: Array.from(panels).map((p, idx) => ({
        index: idx,
        className: p.className,
        rect: getRect(p)
      }))
    };
    
    return result;
  });
  
  console.log('=== 1440x900 VIEWPORT ===');
  console.log(JSON.stringify(measurements, null, 2));
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/game-loop-screenshot-1440.png', fullPage: false });
  console.log('\nScreenshot saved to /tmp/game-loop-screenshot-1440.png');
  
  // Also test at 1920x1080
  console.log('\n=== Testing at 1920x1080 ===');
  await page.setViewport({ width: 1920, height: 1080 });
  await delay(500);
  
  const measurements1920 = await page.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const grid = document.querySelector('.grid');
    const panels = document.querySelectorAll('.panel');
    
    const getRect = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      };
    };
    
    const result = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      toolbar: getRect(toolbar),
      grid: getRect(grid),
      panels: Array.from(panels).map((p, idx) => ({
        index: idx,
        className: p.className,
        rect: getRect(p)
      }))
    };
    
    return result;
  });
  
  console.log(JSON.stringify(measurements1920, null, 2));
  
  await page.screenshot({ path: '/tmp/game-loop-screenshot-1920.png', fullPage: false });
  console.log('\nScreenshot saved to /tmp/game-loop-screenshot-1920.png');
  
  await browser.close();
})();
