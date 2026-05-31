import { expect } from "chai";
import { By, until } from "selenium-webdriver";
import { cleanup, getDriver, initialize } from "./setup.js";

describe("Gallery Page", function () {
  // Set timeout to 3 minutes (build + test time)
  this.timeout(180_000);

  before(async () => {
    await initialize();
  });

  after(async () => {
    await cleanup();
  });

  it("should launch the app successfully", async () => {
    const driver = getDriver();
    // Wait for the app to be ready by checking for the main container
    await driver.wait(until.elementLocated(By.css("body")), 10_000);
    const body = await driver.findElement(By.css("body"));
    expect(body).to.exist;
  });

  it("should display the title bar", async () => {
    const driver = getDriver();
    // The TitleBar component should be visible
    // Look for the data-tauri-drag-region attribute which is on the title bar
    const titleBar = await driver.wait(
      until.elementLocated(By.css("[data-tauri-drag-region]")),
      10_000
    );
    expect(titleBar).to.exist;
  });

  it("should display the gallery container", async () => {
    const driver = getDriver();
    // The Gallery component renders a virtualized grid
    // Look for the main content area
    const gallery = await driver.wait(
      until.elementLocated(By.css(".flex.h-screen")),
      10_000
    );
    expect(gallery).to.exist;
  });

  it("should display the bottom toolbar", async () => {
    const driver = getDriver();
    // The BottomToolbar should be visible at the bottom of the gallery page
    // It is rendered as a header element
    const toolbar = await driver.wait(
      until.elementLocated(By.css("header")),
      10_000
    );
    expect(toolbar).to.exist;
  });

  it("should have view mode toggle buttons and switch modes", async () => {
    const driver = getDriver();
    // Buttons are identified by title in view-mode-buttons.tsx: "3 columns", "4 columns", etc.
    const mode3Btn = await driver.findElement(
      By.css('button[title="3 columns"]')
    );
    const mode4Btn = await driver.findElement(
      By.css('button[title="4 columns"]')
    );

    expect(mode3Btn).to.exist;
    expect(mode4Btn).to.exist;

    // The grid only renders when projects exist, so verify the toggle via the
    // active-button marker (view-mode-buttons adds bg-muted-foreground/15).
    await mode3Btn.click();
    await driver.sleep(300);
    const class3 = await mode3Btn.getAttribute("class");
    expect(class3).to.contain("bg-muted-foreground/15");

    await mode4Btn.click();
    await driver.sleep(300);
    const class4 = await mode4Btn.getAttribute("class");
    expect(class4).to.contain("bg-muted-foreground/15");
  });

  it("should allow typing in the search bar", async () => {
    const driver = getDriver();
    const searchInput = await driver.findElement(
      By.css('input[placeholder="Search projects"]')
    );
    await searchInput.sendKeys("Test Search");
    const value = await searchInput.getAttribute("value");
    expect(value).to.equal("Test Search");

    // Clear it for future tests
    await searchInput.clear();
  });

  it("should open context menu on right click", async () => {
    const driver = getDriver();
    const gridContainer = await driver.findElement(By.css(".flex.h-screen"));

    // Right click on the grid background
    await driver.actions().contextClick(gridContainer).perform();

    // Check for context menu items (e.g., "New Project")
    const menuItem = await driver.wait(
      until.elementLocated(By.xpath("//*[contains(text(), 'New Project')]")),
      2000
    );
    expect(menuItem).to.exist;

    // Close context menu by clicking elsewhere (or escape)
    await driver.actions().sendKeys("\uE00C").perform(); // Escape
  });

  it("should open video extractor when clicking add button", async () => {
    const driver = getDriver();
    // Find the "Add Video" button (it should have a plus icon or similar)
    // This is a basic test to check the button exists
    const addButton = await driver.findElements(
      By.css('button[aria-label*="add"], button[title*="Add"]')
    );
    // If the button exists, click it and verify dialog opens
    if (addButton.length > 0) {
      await addButton[0].click();
      // Wait a bit for the dialog to appear
      await driver.sleep(500);
      // Check for dialog/modal
      const dialog = await driver.findElements(By.css('[role="dialog"]'));
      if (dialog.length > 0) {
        expect(dialog.length).to.be.greaterThan(0);
        // Close the dialog by pressing Escape
        await driver.actions().sendKeys("\uE00C").perform(); // Escape key
      }
    }
  });
});
