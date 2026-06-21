const puppeteer = require('puppeteer');

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
  await page.waitForTimeout(1000);
  
  // Check if we're on a landing page and need to click a button
  const startButton = await page.$('button.primary');
  if (startButton) {
    const text = await page.evaluate(btn => btn.textContent, startButton);
    if (text.includes('Start') || text.includes('Play') || text.includes('Enter')) {
      console.log('Found and clicking:', text);
      await startButton.click();
      await page.waitForTimeout(500);
    }
  }
  
  // Now measure the layout
  const measurements = await page.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const grid = document.querySelector('.grid');
    const panels = document.querySelectorAll('.panel');
    
    const result = {
      viewportWidth: window.innerWidth,
      toolbar: toolbar ? toolbar.getBoundingClientRect() : null,
      grid: grid ? grid.getBoundingClientRect() : null,
      panels: Array.from(panels).map(p => ({
        className: p.className,
        rect: p.getBoundingClientRect()
      }))
    };
    
    return result;
  });
  
  console.log(JSON.stringify(measurements, null, 2));
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/game-loop-screenshot.png', fullPage: false });
  console.log('Screenshot saved to /tmp/game-loop-screenshot.png');
  
  // Also test at 1920x1080
  console.log('\n--- Testing at 1920x1080 ---');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  
  const measurements1920 = await page.evaluate(() => {
    const toolbar = document.querySelector('.toolbar');
    const grid = document.querySelector('.grid');
    const panels = document.querySelectorAll('.panel');
    
    const result = {
      viewportWidth: window.innerWidth,
      toolbar: toolbar ? toolbar.getBoundingClientRect() : null,
      grid: grid ? grid.getBoundingClientRect() : null,
      panels: Array.from(panels).map(p => ({
        className: p.className,
        rect: p.getBoundingClientRect()
      }))
    };
    
    return result;
  });
  
  console.log(JSON.stringify(measurements1920, null, 2));
  
  await browser.close();
})();
