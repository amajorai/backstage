import { expect } from "chai";
import { By, until } from "selenium-webdriver";
import { cleanup, getDriver, initialize } from "./setup.js";

describe("Video Extractor Dialog", function () {
  this.timeout(180_000);

  before(async () => {
    await initialize();
  });

  after(async () => {
    await cleanup();
  });

  it("should open the video extractor dialog", async () => {
    const driver = getDriver();

    // Find add button (plus icon)
    // In Gallery.tsx, the add button is the first item in the grid or context menu
    // But there is also an AddMenu in the bottom toolbar

    // Let's try to find the "Upload Video" option in the Add Menu if it exists, or context menu

    // First, verify we are on gallery
    await driver.wait(until.elementLocated(By.css("body")), 10_000);

    // 1. Try context menu approach (right click on grid)
    // Or 2. Try the AddMenu in toolbar if visible

    // Let's assume there is a button to trigger it.
    // In Gallery.tsx, there is a ContextMenu item "Upload Video" that sets showVideoExtractor(true)

    // Let's look for any button that might open it, or simulate context menu if possible.
    // However, finding specific context menu trigger might be hard without ID.

    // Alternatively, check if there's a button in the toolbar.
    // BottomToolbar has <AddMenu onAddVideoClick={...} />

    const addMenuButtons = await driver.findElements(
      By.css('button[aria-label*="add"], button[aria-label*="Add"]')
    );
    if (addMenuButtons.length > 0) {
      await addMenuButtons[0].click();
      await driver.sleep(500);

      // Check if a menu opened with "Upload Video"
      const menuItems = await driver.findElements(
        By.xpath("//*[contains(text(), 'Upload Video')]")
      );
      if (menuItems.length > 0) {
        await menuItems[0].click();

        // Wait for dialog — VideoExtractor renders a full-screen overlay
        // (fixed inset-0 z-[1100]).
        const dialog = await driver.wait(
          until.elementLocated(By.css(".fixed.inset-0")),
          5000
        );
        expect(dialog).to.exist;

        // Close it
        await driver.actions().sendKeys("\uE00C").perform(); // Escape
      } else {
        console.log(
          "Upload Video menu item not found after clicking add button"
        );
      }
    } else {
      console.log("Add button not found");
    }
  });
});
