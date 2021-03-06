/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, product, CHROMIUM, FFOX}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  (CHROMIUM || FFOX) && describe('Web SDK', function() {
    beforeAll(async state => {
      state.controlledBrowserApp = await playwright.launchBrowserApp({ ...defaultBrowserOptions, webSocket: true });
      state.hostBrowserApp = await playwright.launchBrowserApp(defaultBrowserOptions);
      state.hostBrowser = await playwright.connect(state.hostBrowserApp.connectOptions());
    });

    afterAll(async state => {
      await state.hostBrowserApp.close();
      state.hostBrowser = null;
      state.hostBrowserApp = null;

      await state.controlledBrowserApp.close();
      state.controlledBrowserApp = null;
      state.webUrl = null;
    });

    beforeEach(async state => {
      state.page = await state.hostBrowser.defaultContext().newPage();
      state.page.on('console', message => console.log('TEST: ' + message.text()));
      await state.page.goto(state.sourceServer.PREFIX + '/test/assets/playwrightweb.html');
      await state.page.evaluate((product, connectOptions) => setup(product, connectOptions), product.toLowerCase(), state.controlledBrowserApp.connectOptions());
    });

    afterEach(async state => {
      await state.page.evaluate(() => teardown());
      await state.page.close();
      state.page = null;
    });

    it('should navigate', async({page, server}) => {
      const url = await page.evaluate(async url => {
        await page.goto(url);
        return page.evaluate(() => window.location.href);
      }, server.EMPTY_PAGE);
      expect(url).toBe(server.EMPTY_PAGE);
    });

    it('should receive events', async({page, server}) => {
      const logs = await page.evaluate(async url => {
        const logs = [];
        page.on('console', message => logs.push(message.text()));
        await page.evaluate(() => console.log('hello'));
        await page.evaluate(() => console.log('world'));
        return logs;
      }, server.EMPTY_PAGE);
      expect(logs).toEqual(['hello', 'world']);
    });

    it('should take screenshot', async({page, server}) => {
      const { base64, bufferClassName } = await page.evaluate(async url => {
        await page.setViewport({width: 500, height: 500});
        await page.goto(url);
        const screenshot = await page.screenshot();
        return { base64: screenshot.toString('base64'), bufferClassName: screenshot.constructor.name };
      }, server.PREFIX + '/grid.html');
      const screenshot = Buffer.from(base64, 'base64');
      expect(screenshot).toBeGolden('screenshot-sanity.png');
      // Verify that we use web versions of node-specific classes.
      expect(bufferClassName).toBe('BufferImpl');
    });
  });
};
