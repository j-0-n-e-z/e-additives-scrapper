"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const constants_1 = require("./constants");
getAdditives(constants_1.ADDITIVES_URL);
function getAdditives(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer_1.default.launch({ headless: false });
        const page = yield browser.newPage();
        try {
            yield page.goto(url, { waitUntil: 'domcontentloaded' });
            const loadMoreButton = yield page.$('.pager__item');
            if (loadMoreButton) {
                loadMoreButton.click();
                yield page.waitForSelector('.pager__item', {
                    timeout: 4000,
                    hidden: true
                });
            }
            const origins = yield scrapOrigins(page);
            // console.log('@origins', origins)
            const [additivesWithNoDangerReason, additiveLinks] = yield scrapAdditives(page, origins);
            // console.log('@additive_links', additiveLinks)
            const dangerReasons = yield scrapDangerReasons(page, additiveLinks);
            // console.log('@danger', dangerReasons);
            const additives = additivesWithNoDangerReason.map((add, idx) => {
                var _a;
                return (Object.assign(Object.assign({}, add), { danger: Object.assign(Object.assign({}, add.danger), { reasons: (_a = dangerReasons === null || dangerReasons === void 0 ? void 0 : dangerReasons[idx]) !== null && _a !== void 0 ? _a : [] }) }));
            });
            // console.log('@additives', additives)
            if (additives === null || additives === void 0 ? void 0 : additives.length) {
                fs_1.default.writeFile('additives.json', JSON.stringify(additives), err => { });
            }
        }
        catch (e) {
            showError(e);
        }
        finally {
            yield browser.close();
        }
    });
}
function scrapOrigins(page) {
    return __awaiter(this, void 0, void 0, function* () {
        const origins = {};
        const originElements = yield page.$$('.term--additive-origins');
        //TODO:add try catch
        for (const originElement of originElements) {
            const key = yield originElement.evaluate(el => el.classList[1].slice(-2));
            const origin = yield originElement.evaluate(el => { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || ''; });
            origins[key] = origin.trim();
        }
        return origins;
    });
}
function scrapAdditives(page, origins) {
    return __awaiter(this, void 0, void 0, function* () {
        const additiveLinks = [];
        const additiveElements = yield page.$$('.addicon');
        const additives = [];
        for (const additiveElement of additiveElements) {
            const dangerLevel = yield additiveElement.evaluate(el => Number(el.classList[1].at(-1)));
            const additiveOrigins = [];
            const originElements = yield additiveElement.$$('.addicon__origin-item');
            for (const originElement of originElements) {
                const key = yield originElement.evaluate(el => el.classList[1].slice(-2));
                additiveOrigins.push(origins[key]);
            }
            try {
                const [code, name, additiveLink] = yield additiveElement.$eval('.addicon__link', node => {
                    var _a;
                    return [
                        ...((_a = node.textContent) !== null && _a !== void 0 ? _a : '').split(' – '),
                        node.getAttribute('href')
                    ];
                });
                if (!code)
                    throw new Error('Code was not found');
                if (!name)
                    throw new Error('Name was not found');
                if (!additiveLink)
                    throw new Error('Additive link was not found');
                additiveLinks.push(additiveLink);
                additives.push({
                    code,
                    name: name.toLowerCase(),
                    danger: { level: dangerLevel, reasons: [] },
                    origins: additiveOrigins
                });
            }
            catch (e) {
                showError(e);
            }
        }
        return [additives, additiveLinks];
    });
}
function scrapDangerReasons(page, additiveLinks) {
    return __awaiter(this, void 0, void 0, function* () {
        const dangerReasons = [];
        try {
            for (const additiveLink of additiveLinks) {
                yield page.goto(additiveLink, {
                    timeout: 0,
                    waitUntil: 'domcontentloaded'
                });
                let dangerReason = yield page.$('h3.poor');
                if (dangerReason) {
                    const dangerReasonParagraphs = [];
                    let next = yield page.evaluateHandle(el => el.nextElementSibling, dangerReason);
                    if (next) {
                        let nextText = yield page.evaluate(el => el === null || el === void 0 ? void 0 : el.textContent, next);
                        console.log(nextText);
                        while (nextText &&
                            !nextText.startsWith('Использование') &&
                            !nextText.startsWith('Польза')) {
                            if (nextText) {
                                dangerReasonParagraphs.push(nextText);
                            }
                            next = yield page.evaluateHandle(el => { var _a; return (_a = el === null || el === void 0 ? void 0 : el.nextElementSibling) !== null && _a !== void 0 ? _a : null; }, next);
                            nextText = yield page.evaluate(el => el === null || el === void 0 ? void 0 : el.textContent, next);
                        }
                    }
                    dangerReasons.push(dangerReasonParagraphs);
                }
            }
        }
        catch (e) {
            showError(e);
        }
        return dangerReasons;
    });
}
function showError(e) {
    if (typeof e === typeof Error) {
        // console.log((e as Error).message)
    }
    else if (typeof e === 'string') {
        // console.log(e)
    }
}
