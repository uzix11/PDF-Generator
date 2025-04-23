// ========================================================================
// popup.js - Wersja zrefaktoryzowana, poprawiona
// ========================================================================

// ------------------------------------------------------------------------
// KONFIGURACJA I STAŁE
// ------------------------------------------------------------------------
const QUALITY_SETTINGS = {
    high: { scale: window.devicePixelRatio || 1, format: 'png', quality: undefined },
    default: { scale: window.devicePixelRatio || 1, format: 'jpeg', quality: 0.99 },
    economy: { scale: 1, format: 'jpeg', quality: 0.77 }
};
const DEFAULT_QUALITY_KEY = 'default';
const SCROLL_OPTIONS = { PAUSE_TIME_MS: 800, MAX_SCROLLS: 100 };
const YOUTUBE_SETTINGS = { HOSTNAME: "www.youtube.com", APP_SELECTOR: "ytd-app" };
const DOM_SELECTORS = {
    statusDiv: '#status', generateBtn: '#generateBtn',
    scrollCheckbox: '#scrollPage', qualityRadios: 'input[name="quality"]',
    defaultQualityRadio: `#quality${DEFAULT_QUALITY_KEY.charAt(0).toUpperCase() + DEFAULT_QUALITY_KEY.slice(1)}`
};

// ========================================================================
// FUNKCJE WYKONYWANE W KONTEKŚCIE STRONY DOCELOWEJ (WSTRZYKIWANE)
// ========================================================================

/**
 * Szybkie przechwytywanie strony bez przewijania.
 * Wykonuje się w kontekście strony docelowej.
 * @param {object} captureOptions Opcje przechwytywania (scale, format, quality).
 * @returns {Promise<object>} Obiekt z wynikami lub błędem.
 */
/**
 * Szybkie przechwytywanie strony bez przewijania.
 * Zmodyfikowana wersja: najpierw przewija stronę do góry, wykonuje przechwycenie,
 * a następnie przywraca poprzednią pozycję przewinięcia.
 *
 * @param {object} captureOptions Opcje przechwytywania (scale, format, quality).
 * @returns {Promise<object>} Obiekt z wynikami lub błędem.
 */
function capturePageContent(captureOptions) {
    if (typeof html2canvas === 'undefined') {
        return { error: "html2canvas not loaded", imageFormat: null };
    }
    console.log("[ContentScript] Uruchamiam szybkie przechwytywanie z poprawką do scrolla, opcje:", captureOptions);

    // Zapisz bieżącą pozycję scrolla
    const originalScrollY = window.scrollY;
    // Przewiń stronę do góry, aby upewnić się, że cały kontener jest widoczny
    window.scrollTo(0, 0);

    // Poczekaj chwilę (np. 300 ms), aby strona mogła się "ustabilizować"
    return new Promise(resolve => {
        setTimeout(() => {
            // --- Logika wyboru kontenera (np. YouTube) ---
            let container = document.body;
            if (window.location.hostname === "www.youtube.com") {
                console.log("[ContentScript] Wykryto YouTube, próbuję użyć selektora: ytd-app");
                try {
                    const ytAppContainer = document.querySelector("ytd-app");
                    if (ytAppContainer) {
                        container = ytAppContainer;
                        console.log("[ContentScript] Znaleziono i użyto kontenera YouTube.");
                    } else {
                        console.warn(`[ContentScript] Nie znaleziono selektora "ytd-app", używam document.body.`);
                    }
                } catch (e) {
                    console.error("[ContentScript] Błąd querySelector dla \"ytd-app\":", e);
                    console.warn("[ContentScript] Używam document.body jako fallback.");
                }
            }
            console.log("[ContentScript] Ostateczny kontener do przechwycenia:", container);

            const options = {
                scrollY: 0,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
                scale: captureOptions.scale
            };

            html2canvas(container, options)
                .then(canvas => {
                    console.log("[ContentScript] html2canvas zakończyło przechwytywanie.");
                    const format = captureOptions.format === 'jpeg' ? 'image/jpeg' : 'image/png';
                    const quality = captureOptions.format === 'jpeg' ? captureOptions.quality : undefined;
                    const dataUrl = quality !== undefined ? canvas.toDataURL(format, quality) : canvas.toDataURL(format);
                    const imageFormat = captureOptions.format === 'jpeg' ? 'JPEG' : 'PNG';

                    // Przywróć oryginalną pozycję scrolla
                    window.scrollTo(0, originalScrollY);

                    resolve({ dataUrl, pageTitle: document.title, pageUrl: window.location.href, imageFormat });
                })
                .catch(error => {
                    console.error("[ContentScript] Błąd html2canvas (capturePageContent):", error);
                    // Przywróć pozycję scrolla nawet przy błędzie
                    window.scrollTo(0, originalScrollY);
                    resolve({ error: `html2canvas failed: ${error.message}`, imageFormat: null });
                });
        }, 300); // Czas oczekiwania
    });
}


/**
 * Przechwytywanie strony z próbą przewinięcia jej do końca.
 * Wykonuje się w kontekście strony docelowej.
 * @param {object} captureOptions Opcje przechwytywania (scale, format, quality).
 * @returns {Promise<object>} Obiekt z wynikami lub błędem.
 */
async function captureFullPageWithScrolling(captureOptions) {
    if (typeof html2canvas === 'undefined') { return { error: "html2canvas not loaded", imageFormat: null }; }
    console.log("[ContentScript] Rozpoczynam przechwytywanie z przewijaniem, opcje:", captureOptions);

    const SCROLL_PAUSE_TIME_IN_PAGE = 1000;
    const MAX_SCROLLS_IN_PAGE = 100;
    let scrolls = 0;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    let containerToCapture = document.body; // Zmienna dla kontenera do przechwycenia
    const YOUTUBE_HOSTNAME_IN_PAGE = "www.youtube.com"; // Wartości używane bezpośrednio
    const YOUTUBE_APP_SELECTOR_IN_PAGE = "ytd-app";
    if (window.location.hostname === YOUTUBE_HOSTNAME_IN_PAGE) {
        console.log("[ContentScript] Wykryto YouTube (scroll), próbuję użyć selektora:", YOUTUBE_APP_SELECTOR_IN_PAGE);
        try {
            const ytAppContainer = document.querySelector(YOUTUBE_APP_SELECTOR_IN_PAGE);
            if (ytAppContainer) {
                containerToCapture = ytAppContainer; // Użyj znalezionego kontenera
                console.log("[ContentScript] Znaleziono i użyto kontenera YouTube (scroll).");
            } else {
                console.warn(`[ContentScript] Nie znaleziono selektora "${YOUTUBE_APP_SELECTOR_IN_PAGE}", używam document.body (scroll).`);
            }
        } catch (e) {
            console.error(`[ContentScript] Błąd querySelector dla "${YOUTUBE_APP_SELECTOR_IN_PAGE}" (scroll):`, e);
            console.warn("[ContentScript] Używam document.body jako fallback (scroll).");
        }
    }
    console.log("[ContentScript] Ostateczny kontener do przechwycenia (scroll):", containerToCapture);
    // --- Koniec logiki wyboru kontenera ---

    try {
        // --- Logika przewijania okna ---
        let distance = window.innerHeight * 0.9; console.log("[ContentScript] Przewijanie strony (window)...");
        while (scrolls < MAX_SCROLLS_IN_PAGE) {
            let scrollHeightBefore = document.body.scrollHeight; let scrollYBefore = window.scrollY;
            window.scrollBy(0, distance); await wait(SCROLL_PAUSE_TIME_IN_PAGE);
            let scrollHeightAfter = document.body.scrollHeight; let scrollYAfter = window.scrollY;
            if (((window.innerHeight + scrollYAfter >= scrollHeightAfter) || (scrollYAfter === scrollYBefore)) && (scrollHeightBefore === scrollHeightAfter)) { console.log(`[ContentScript] Zatrzymanie przewijania.`); break; }
            scrolls++; console.log(`[ContentScript] Przewinięcie ${scrolls}/${MAX_SCROLLS_IN_PAGE}, H: ${scrollHeightAfter}px, Y: ${scrollYAfter.toFixed(0)}px`);
        }
        if (scrolls >= MAX_SCROLLS_IN_PAGE) { console.warn("[ContentScript] Osiągnięto max przewinięć."); }
        // --- Koniec logiki przewijania ---

        console.log("[ContentScript] Przewijanie zakończone. Powrót na górę...");
        window.scrollTo(0, 0); await wait(SCROLL_PAUSE_TIME_IN_PAGE);

        console.log("[ContentScript] Uruchamiam html2canvas po przewinięciu...");
        const options = {
            scrollY: -window.scrollY, y: 0, backgroundColor: "#ffffff",
            useCORS: true, logging: false, scale: captureOptions.scale
        };

        // Przechwyć wybrany kontener (containerToCapture)
        const canvas = await html2canvas(containerToCapture, options);
        console.log("[ContentScript] captureFullPageWithScrolling: html2canvas zakończone.");

        const format = captureOptions.format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const quality = captureOptions.format === 'jpeg' ? captureOptions.quality : undefined;
        const dataUrl = quality !== undefined ? canvas.toDataURL(format, quality) : canvas.toDataURL(format);
        const imageFormat = captureOptions.format === 'jpeg' ? 'JPEG' : 'PNG';
        console.log(`[ContentScript] Wygenerowano ${imageFormat} Data URL (jakość: ${quality ?? 'N/A'}, skala: ${captureOptions.scale}, długość: ${dataUrl.length})`);
        return { dataUrl, pageTitle: document.title, pageUrl: window.location.href, imageFormat };

    } catch (error) {
        console.error("[ContentScript] Błąd podczas przechwytywania z przewijaniem:", error);
        return { error: `Capture with scroll failed: ${error.message}`, imageFormat: null };
    }
}


// ========================================================================
// FUNKCJE POMOCNICZE WYKONYWANE W KONTEKŚCIE POPUPU
// ========================================================================

/**
 * Rysuje nagłówek na bieżącej stronie PDF.
 * @param {jsPDF} pdf Instancja jsPDF.
 * @param {string} pageTitle Tytuł strony.
 * @param {string} pageUrl Adres URL strony.
 * @param {number} currentPage Numer bieżącej strony (zaczynając od 1).
 * @param {number} totalPages Całkowita liczba stron.
 * @param {number} margin Margines strony.
 * @param {number} headerFontSize Rozmiar czcionki nagłówka.
 * @param {number} lineSpacing Odstęp między liniami nagłówka.
 * @returns {number} Wysokość Y, na której zakończono rysowanie nagłówka.
 */
function _drawPdfHeader(pdf, pageTitle, pageUrl, currentPage, totalPages, margin, headerFontSize, lineSpacing) {
    console.log(`[generatePDF] Strona ${currentPage}/${totalPages} - Rysuję nagłówek`);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const maxWidthForText = pdfWidth - 2 * margin;

    pdf.setFont("Roboto_Condensed-Regular", "normal");
    pdf.setFontSize(headerFontSize);

    // Przygotowanie tekstu nagłówka
    const titleText = "Tytuł/Title: " + pageTitle;
    const urlText = "URL: " + pageUrl;
    const pageNumText = `Strona/Page: ${currentPage} / ${totalPages}`;

    // Podział tekstu, aby mieścił się w zadanej szerokości
    const splitTitle = pdf.splitTextToSize(titleText, maxWidthForText);
    const splitUrl = pdf.splitTextToSize(urlText, maxWidthForText);

    let currentY = margin; // Początek rysowania od górnego marginesu

    // Rysowanie tytułu
    pdf.text(splitTitle, margin, currentY);
    currentY += splitTitle.length * lineSpacing;

    // Rysowanie adresu URL
    pdf.text(splitUrl, margin, currentY);
    currentY += splitUrl.length * lineSpacing;


    // Dodanie daty i godziny
    const now = new Date();
    const dateString = now.getFullYear() + '-' +
        ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
        ('0' + now.getDate()).slice(-2);
    const timeString = ('0' + now.getHours()).slice(-2) + ':' +
        ('0' + now.getMinutes()).slice(-2);
    const dateTimeStr = dateString + ' ' + timeString;
    pdf.text("Data/Date: " + dateTimeStr, margin, currentY);
    currentY += lineSpacing;

    // Rysowanie numeru strony (wyśrodkowane)
    const pageNumWidth = pdf.getStringUnitWidth(pageNumText) * headerFontSize / pdf.internal.scaleFactor;
    pdf.text(pageNumText, (pdfWidth - pageNumWidth) / 2, currentY);
    currentY += lineSpacing;

    console.log(`[generatePDF] Strona ${currentPage}/${totalPages} - Nagłówek (wraz z datą) narysowany`);
    return currentY; // Zwraca pozycję Y po zakończonym nagłówku
}


/**
 * Dodaje fragment obrazu strony do bieżącej strony PDF.
 * @param {jsPDF} pdf Instancja jsPDF.
 * @param {HTMLImageElement} img Załadowany obiekt obrazu całej strony.
 * @param {number} pageIndex Indeks bieżącej strony (zaczynając od 0).
 * @param {number} headerHeight Wysokość nagłówka w punktach.
 * @param {number} contentHeightPerPage Maksymalna wysokość na obraz na stronie PDF.
 * @param {number} imgTotalHeightInPdf Całkowita wysokość obrazu przeskalowanego do szerokości PDF.
 * @param {number} imgWidthInPdf Szerokość obrazu w PDF (z uwzględnieniem marginesów).
 * @param {number} margin Margines strony.
 * @param {string} imageFormat Format obrazu ('JPEG' lub 'PNG').
 * @param {number|undefined} jpegQuality Jakość JPEG (jeśli dotyczy).
 * @returns {number} Wysokość dodanego fragmentu obrazu w jednostkach canvasu źródłowego.
 */
async function _addPdfImageSlice(pdf, img, pageIndex, headerHeight, contentHeightPerPage, imgTotalHeightInPdf, imgWidthInPdf, margin, imageFormat, jpegQuality) {
    // ... (kod bez zmian) ...
    const currentPageNum = pageIndex + 1;
    console.log(`[generatePDF] Strona ${currentPageNum} - Przygotowuję fragment obrazu`);
    const imgNativeWidth = img.width; const imgNativeHeight = img.height;
    const pdfImageSliceHeight = Math.min(contentHeightPerPage, imgTotalHeightInPdf - (pageIndex * contentHeightPerPage));
    const canvasSliceHeight = (pdfImageSliceHeight * imgNativeWidth) / imgWidthInPdf;
    const canvasSliceY = (pageIndex * contentHeightPerPage * imgNativeWidth) / imgWidthInPdf;
    console.log(`[generatePDF] Strona ${currentPageNum} - Wymiary fragmentu (PDF): ${imgWidthInPdf.toFixed(2)}x${pdfImageSliceHeight.toFixed(2)}pt, Wymiary fragmentu (Canvas): ${imgNativeWidth}x${canvasSliceHeight.toFixed(2)}px @ Y=${canvasSliceY.toFixed(2)}px`);
    const tempCanvas = document.createElement('canvas'); tempCanvas.width = Math.max(1, Math.round(imgNativeWidth)); tempCanvas.height = Math.max(1, Math.round(canvasSliceHeight));
    if (tempCanvas.width <= 0 || tempCanvas.height <= 0) { console.error(/*...*/); pdf.text(/*...*/); return canvasSliceHeight; }
    const tempCtx = tempCanvas.getContext('2d'); tempCtx.fillStyle = '#ffffff'; tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    console.log(`[generatePDF] Strona ${currentPageNum} - Rysuję fragment na temp canvas ${tempCanvas.width}x${tempCanvas.height}`);
    try { tempCtx.drawImage(img, 0, canvasSliceY, imgNativeWidth, canvasSliceHeight, 0, 0, tempCanvas.width, tempCanvas.height); } catch (e) { console.error(/*...*/); pdf.text(/*...*/); return canvasSliceHeight; }
    try {
        const tempCanvasFormat = imageFormat === 'JPEG' ? 'image/jpeg' : 'image/png';
        const tempCanvasQuality = imageFormat === 'JPEG' ? jpegQuality : undefined;
        const sliceDataUrl = tempCanvasQuality !== undefined ? tempCanvas.toDataURL(tempCanvasFormat, tempCanvasQuality) : tempCanvas.toDataURL(tempCanvasFormat);
        console.log(`[generatePDF] Strona ${currentPageNum} - sliceDataUrl (${imageFormat}, q=${tempCanvasQuality ?? 'N/A'}) gotowy (długość: ${sliceDataUrl.length}), dodaję do PDF...`);
        pdf.addImage(sliceDataUrl, imageFormat, margin, headerHeight, imgWidthInPdf, pdfImageSliceHeight); // Użyj imgWidthInPdf
        console.log(`[generatePDF] Strona ${currentPageNum} - Fragment obrazu (${imageFormat}) dodany do PDF.`);
    } catch (e) { console.error(/*...*/); pdf.text(/*...*/); }
    return canvasSliceHeight;
}


/**
 * Główna funkcja generująca dokument PDF.
 * @param {string} imgDataUrl Data URL całego obrazu strony (PNG lub JPEG).
 * @param {string} pageTitle Tytuł strony.
 * @param {string} pageUrl Adres URL strony.
 * @param {string} imageFormat Format obrazu ('JPEG' lub 'PNG').
 * @param {number|undefined} jpegQuality Jakość JPEG (jeśli format to JPEG).
 * @param {HTMLElement} statusElement Element DOM do wyświetlania statusu.
 */
async function generatePDF(imgDataUrl, pageTitle, pageUrl, imageFormat, jpegQuality, statusElement) {
    // ... (kod bez zmian - używa _drawPdfHeader i _addPdfImageSlice) ...
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') { throw new Error("..."); }
    const { jsPDF } = window.jspdf;
    console.log(`[generatePDF] Start (format: ${imageFormat}, jakość JPEG: ${jpegQuality ?? 'N/A'})`); statusElement.textContent = "Inicjalizuję...";
    const pdf = new jsPDF('p', 'pt', 'a4'); const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 40; const headerFontSize = 10; const lineSpacing = headerFontSize * 1.2;
    console.log("[generatePDF] Ustawiam czcionkę..."); statusElement.textContent = "Ustawiam czcionkę...";
    try { pdf.setFont("Roboto_Condensed-Regular", "normal"); } catch (e) { throw new Error("..."); }
    pdf.setFontSize(headerFontSize); console.log("[generatePDF] Czcionka ustawiona");
    statusElement.textContent = `Ładuję obraz (${imageFormat})...`; console.log("[generatePDF] Tworzę Image...");
    const img = new Image(); img.src = imgDataUrl;
    try { console.log("[generatePDF] Oczekuję na onload..."); await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; }); console.log(`[generatePDF] Obraz załadowany: ${img.width}x${img.height}`); } catch (error) { throw new Error("..."); }
    if (img.width === 0 || img.height === 0) { throw new Error("..."); }
    const imgNativeWidth = img.width; const imgNativeHeight = img.height;
    const imgWidthInPdf = pdfWidth - 2 * margin; const imgTotalHeightInPdf = (imgNativeHeight * imgWidthInPdf) / imgNativeWidth;
    const dryRunPdf = new jsPDF('p', 'pt', 'a4'); const headerEndY = _drawPdfHeader(dryRunPdf, pageTitle, pageUrl, 1, 1, margin, headerFontSize, lineSpacing);
    const headerHeight = headerEndY; const contentHeightPerPage = pdfHeight - headerHeight - margin;
    console.log(`[generatePDF] Nagłówek: ${headerHeight.toFixed(2)}pt, Kontent/strona: ${contentHeightPerPage.toFixed(2)}pt`);
    if (contentHeightPerPage <= 0) { throw new Error("..."); }
    const totalPages = Math.ceil(imgTotalHeightInPdf / contentHeightPerPage); console.log(`[generatePDF] Liczba stron: ${totalPages}`); statusElement.textContent = `Generuję ${totalPages} stron...`;
    let cumulativeCanvasHeight = 0; // Zmienna pomocnicza do śledzenia wysokości
    console.log("[generatePDF] Pętla po stronach...");
    for (let i = 0; i < totalPages; i++) {
        const currentPageNum = i + 1; console.log(`[generatePDF] Strona ${currentPageNum}/${totalPages} - Start`); statusElement.textContent = `Generuję stronę ${currentPageNum}/${totalPages}...`;
        if (i > 0) { pdf.addPage(); }
        const currentHeaderHeight = _drawPdfHeader(pdf, pageTitle, pageUrl, currentPageNum, totalPages, margin, headerFontSize, lineSpacing);
        // Zaktualizowano wywołanie, aby poprawnie przekazać parametry
        await _addPdfImageSlice(pdf, img, i, currentHeaderHeight, contentHeightPerPage, imgTotalHeightInPdf, imgWidthInPdf, margin, imageFormat, jpegQuality);
        console.log(`[generatePDF] Strona ${currentPageNum}/${totalPages} - Koniec`);
    }
    console.log("[generatePDF] Pętla zakończona."); statusElement.textContent = "Zapisuję PDF...";
    const safeTitle = pageTitle.replace(/[^a-z0-9_-\s]/gi, '_').replace(/[\s]/g, '_'); const fileName = `Strona_${safeTitle.substring(0, 50)}.pdf`;
    console.log(`[generatePDF] Zapisuję jako '${fileName}'...`);
    try { pdf.save(fileName); console.log("[generatePDF] Zapis zakończony."); } catch (e) { console.error("Błąd zapisu:", e); throw e; }
}


// ========================================================================
// GŁÓWNA LOGIKA ROZSZERZENIA (INICJALIZACJA I OBSŁUGA ZDARZEŃ)
// ========================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM załadowany. Inicjalizacja popupu...");
    const statusDiv = document.querySelector(DOM_SELECTORS.statusDiv);
    const generateBtn = document.querySelector(DOM_SELECTORS.generateBtn);
    const scrollPageCheckbox = document.querySelector(DOM_SELECTORS.scrollCheckbox);
    const qualityRadioButtons = document.querySelectorAll(DOM_SELECTORS.qualityRadios);
    const defaultQualityRadio = document.querySelector(DOM_SELECTORS.defaultQualityRadio);

    if (!statusDiv || !generateBtn || !scrollPageCheckbox || qualityRadioButtons.length === 0 || !defaultQualityRadio) { /*...*/ alert("Błąd krytyczny..."); return; }
    console.log("Elementy DOM znalezione.");

    statusDiv.textContent = 'Inicjalizuję czcionkę...'; let fontRegistered = false;
    if (typeof registerJsPDFRobotoCondensed === 'function') { fontRegistered = registerJsPDFRobotoCondensed(); } else { console.error("..."); }
    if (!fontRegistered) { /*...*/ return; }
    console.log("Rejestracja czcionki zakończona (sukces: " + fontRegistered + ")."); statusDiv.textContent = 'Gotowy do generowania.';

    // === Główny nasłuchiwacz zdarzenia kliknięcia przycisku ===
    generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true; statusDiv.textContent = 'Przygotowuję...';
        const shouldScroll = scrollPageCheckbox.checked;
        let selectedQualityKey = DEFAULT_QUALITY_KEY;
        const checkedRadio = document.querySelector('input[name="quality"]:checked');
        if (checkedRadio) { selectedQualityKey = checkedRadio.value; } else { console.warn("..."); defaultQualityRadio.checked = true; }
        const captureOptions = QUALITY_SETTINGS[selectedQualityKey];
        console.log("Wybrane opcje: ", { shouldScroll, selectedQualityKey, captureOptions });

        let tab; try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); console.log("Aktywna karta:", tab ? tab.url : 'Nie znaleziono'); } catch (error) { /*...*/ return; }
        if (!tab || !tab.id) { /*...*/ return; } if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("file://") || tab.url.startsWith("chrome-extension://")) { /*...*/ return; }

        try {
            statusDiv.textContent = 'Ładuję skrypt...'; console.log("Wstrzykuję html2canvas...");
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["libs/html2canvas.min.js"] });
            console.log('html2canvas wstrzyknięty.');

            const functionToExecute = shouldScroll ? captureFullPageWithScrolling : capturePageContent;
            statusDiv.textContent = shouldScroll ? 'Przewijam i przechwytuję...' : 'Przechwytuję stronę...';
            console.log("Wykonuję funkcję przechwytującą:", functionToExecute.name);

            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id }, func: functionToExecute, args: [captureOptions]
            });
            console.log('Funkcja przechwytywania wykonana.');

            if (!injectionResults || !injectionResults[0] || !injectionResults[0].result) { throw new Error("Brak wyników ze skryptu."); }
            const { dataUrl, pageTitle, pageUrl, imageFormat, error: captureError } = injectionResults[0].result;
            console.log("Otrzymano wyniki:", { pageTitle, imageFormat, hasDataUrl: !!dataUrl, captureError });

            if (captureError) { throw new Error(`Błąd przechwytywania: ${captureError}`); }
            if (!dataUrl) { throw new Error("Otrzymano pusty obraz (dataUrl)."); }
            if (!imageFormat || (imageFormat !== 'JPEG' && imageFormat !== 'PNG')) { throw new Error(`Nieprawidłowy format obrazu: ${imageFormat}`); }

            // Przekaż format i jakość (jeśli JPEG) do generatePDF
            await generatePDF(dataUrl, pageTitle, pageUrl, imageFormat.toUpperCase(), captureOptions.quality, statusDiv);
            statusDiv.textContent = 'PDF gotowy!'; console.log("Proces zakończony sukcesem.");

        } catch (error) {
            console.error("Wystąpił błąd:", error); if (statusDiv) { statusDiv.textContent = `Błąd: ${error.message.substring(0, 100)}...`; }
            alert(`Wystąpił błąd:\n${error.message}\n\nSprawdź konsolę.`);
        } finally {
            if (generateBtn) { generateBtn.disabled = false; console.log("Przycisk odblokowany."); }
        }
    }); // Koniec listenera 'click'
    console.log("Inicjalizacja popupu zakończona.");
}); // Koniec listenera 'DOMContentLoaded'