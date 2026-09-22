import { test, expect } from '@playwright/test';

test.describe('SRMIST Campus Gateway — Comprehensive Quiz Editing Suite', () => {
  const testEmail = `playwright_editor_${Date.now()}@srmist.edu.in`;
  const testPassword = 'Password123!';
  const testFullName = 'Quiz Editor QA';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Manual Quiz Creation -> Appears in Dashboard -> Edit Quiz -> Add Question -> Image Attachment -> Save & Persist', async ({ page }) => {
    // 1. Register & Login
    await page.goto('/');
    await page.click('#nav-register-btn');
    await page.waitForSelector('input[placeholder="e.g. Rahul Sharma"]');
    await page.fill('input[placeholder="e.g. Rahul Sharma"]', testFullName);
    await page.fill('input[type="email"]', testEmail);
    await page.locator('input[type="password"]').nth(0).fill(testPassword);
    await page.locator('input[type="password"]').nth(1).fill(testPassword);
    await page.click('button:has-text("Create Campus Account")');

    await expect(page.locator('text=Campus account created!')).toBeVisible();
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Sign In & Continue")');

    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // 2. Click "New Manual Quiz" button
    await page.click('#create-manual-quiz-btn');
    await page.waitForSelector('#quiz-editor-title-input');
    await expect(page.locator('text=Create Manual Quiz')).toBeVisible();

    // 3. Fill Manual Quiz
    const quizTitle = `Compiler Architecture ${Date.now()}`;
    await page.fill('#quiz-editor-title-input', quizTitle);
    await page.fill('#quiz-editor-desc-input', 'Lexical analysis, AST parsing and IR optimization');

    // Fill Question 1
    const q1Input = page.locator('input[placeholder="Enter statement for Question 1..."]');
    await q1Input.fill('What phase produces the Abstract Syntax Tree (AST)?');

    // Fill 4 Options
    const optInputs = page.locator('[data-testid="question-item-0"] input[type="text"]');
    // Notice index 0 is question_text, index 1..4 are options
    await optInputs.nth(1).fill('Lexical Analyzer');
    await optInputs.nth(2).fill('Semantic Parser / Syntax Analyzer');
    await optInputs.nth(3).fill('Peephole Optimizer');
    await optInputs.nth(4).fill('Code Generator');

    // Mark Option B (index 1) as correct
    const optButtons = page.locator('[data-testid="question-item-0"] button[title="Mark as correct answer"]');
    await optButtons.nth(1).click();

    // Add Image via Paste URL
    await page.click('button:has-text("Paste URL")');
    await page.fill('input[placeholder="Paste image URL (https://...)"]', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500');
    await page.click('button:has-text("Apply")');
    await expect(page.locator('text=Attached Image')).toBeVisible();

    // 4. Save Quiz
    await page.click('#quiz-editor-save-btn');
    await expect(page.locator('text=Quiz created successfully!')).toBeVisible();

    // Modal closes automatically after saving
    await expect(page.locator('#quiz-editor-title-input')).not.toBeVisible({ timeout: 5000 });

    // 5. Verify Newly Created Quiz appears in Dashboard Quiz Bank
    await expect(page.locator(`h3:has-text("${quizTitle}")`)).toBeVisible();

    // 6. Find the quiz card and click "Edit"
    const quizCard = page.locator(`[data-testid^="quiz-card-"]:has-text("${quizTitle}")`);
    await expect(quizCard).toBeVisible();

    const editBtn = quizCard.locator('button:has-text("Edit")');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 7. Verify Quiz Editor Opens with EXISTING Data
    await page.waitForSelector('#quiz-editor-title-input');
    await expect(page.locator('text=Edit Quiz')).toBeVisible();
    await expect(page.locator('#quiz-editor-title-input')).toHaveValue(quizTitle);
    await expect(page.locator('#quiz-editor-desc-input')).toHaveValue('Lexical analysis, AST parsing and IR optimization');

    // Verify existing question and image are loaded
    await expect(page.locator('input[value="What phase produces the Abstract Syntax Tree (AST)?"]')).toBeVisible();
    await expect(page.locator('text=Attached Image')).toBeVisible();

    // 8. Modify Quiz: Update Title and Add Question 2
    const updatedTitle = `${quizTitle} (V2 Enhanced)`;
    await page.fill('#quiz-editor-title-input', updatedTitle);

    // Click "Add Question"
    await page.click('#add-question-btn');
    await expect(page.locator('text=Question 2')).toBeVisible();

    // Fill Question 2
    const q2Input = page.locator('input[placeholder="Enter statement for Question 2..."]');
    await q2Input.fill('What is LLVM Intermediate Representation (IR)?');

    const q2OptInputs = page.locator('[data-testid="question-item-1"] input[type="text"]');
    await q2OptInputs.nth(1).fill('A hardware instruction set');
    await q2OptInputs.nth(2).fill('Machine-independent language representation');
    await q2OptInputs.nth(3).fill('A Python virtual machine');
    await q2OptInputs.nth(4).fill('A database query language');

    // Mark Option B on Q2 as correct
    const q2OptButtons = page.locator('[data-testid="question-item-1"] button[title="Mark as correct answer"]');
    await q2OptButtons.nth(1).click();

    // 9. Save Edits
    await page.click('#quiz-editor-save-btn');
    await expect(page.locator('text=Quiz updated successfully!')).toBeVisible();
    await expect(page.locator('#quiz-editor-title-input')).not.toBeVisible({ timeout: 5000 });

    // 10. Verify Updated Quiz Title and Question Count (2 Questions) in Dashboard
    await expect(page.locator(`h3:has-text("${updatedTitle}")`)).toBeVisible();
    const updatedQuizCard = page.locator(`[data-testid^="quiz-card-"]:has-text("${updatedTitle}")`);
    await expect(updatedQuizCard.locator('text=2 Questions')).toBeVisible();
  });
});
