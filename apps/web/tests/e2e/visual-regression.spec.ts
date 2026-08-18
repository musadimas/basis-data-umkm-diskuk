import { test, expect } from "@playwright/test"
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs"
test("analytics canvas named responsive screenshot",async({page},testInfo)=>{await installMockDirectus(page,{authenticated:true});await loginMock(page,"/dashboard/analitik");await expect(page.getByRole("heading",{name:"Canvas analitik"})).toBeVisible();await page.screenshot({path:testInfo.outputPath("analytics-canvas.png"),fullPage:true});await expect(page.getByText("Lihat tabel")).toBeVisible()})
