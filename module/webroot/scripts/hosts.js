import { execCommand, showPrompt, applyRippleEffect, checkMMRL, basePath, initialTransition, setupSwipeToClose } from './util.js';
import { loadTranslations } from './language.js';
import { openFileSelector } from './file_selector.js';

const filePaths = {
    custom: `${basePath}/custom.txt`,
    sources: `${basePath}/sources.txt`,
    blacklist: `${basePath}/blacklist.txt`,
    whitelist: `${basePath}/whitelist.txt`,
    sources_whitelist: `${basePath}/sources_whitelist.txt`,
};

// Function to read a file and display its content in the UI
async function loadFile(fileType) {
    try {
        const content = await execCommand(`
            [ -f ${filePaths[fileType]} ] || touch ${filePaths[fileType]}
            cat ${filePaths[fileType]}
        `);
        const lines = content
            .split("\n")
            .map(line => line)
            .filter(line => line && !line.startsWith("#"));
        displayHostsList(lines, fileType);
    } catch (error) {
        console.error(`Failed to load ${fileType} file: ${error}`);
    }
}

// Function to display hosts list in the UI
function displayHostsList(lines, fileType) {
    const listElement = document.getElementById(`${fileType}-list`);
    listElement.innerHTML = "";
    lines.forEach(line => {
        const listItem = document.createElement("li");
        listItem.innerHTML = `
            <span>${line}</span>
            ${fileType === "import_custom" ? `<button class="edit-btn ripple-element">
                <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#ffffff"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
            </button>` : ""}
            <button class="delete-btn ripple-element" id="${fileType === "import_custom" ? "file-delete" : "line-delete"}">
                <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#ffffff"><path d="M277.37-111.87q-37.78 0-64.39-26.61t-26.61-64.39v-514.5h-45.5v-91H354.5v-45.5h250.52v45.5h214.11v91h-45.5v514.5q0 37.78-26.61 64.39t-64.39 26.61H277.37Zm78.33-168.37h85.5v-360h-85.5v360Zm163.1 0h85.5v-360h-85.5v360Z"/></svg>
            </button>
        `;
        // Click to show remove button
        listElement.appendChild(listItem);
        listItem.addEventListener('click', () => {
            listItem.scrollTo({ left: listItem.scrollWidth, behavior: 'smooth' });
        });
        const deleteLine = listItem.querySelector("#line-delete");
        const deleteFile = listItem.querySelector("#file-delete");
        const editFile = listItem.querySelector(".edit-btn");
        // Remove line from file
        if (deleteLine) {
            deleteLine.addEventListener("click", async () => {
                await execCommand(`
                    filtered=$(grep -vxF '${line}' ${filePaths[fileType]})
                    echo "$filtered" > ${filePaths[fileType]}
                `);
                listElement.removeChild(listItem);
            });
        }
        // Remove file
        if (deleteFile) {
            deleteFile.addEventListener("click", async () => {
                const fileName = listItem.querySelector("span").textContent;
                const remove = await removeCustomHostsFile(fileName);
                if (remove) {
                    await execCommand(`rm -f ${basePath}/${fileName} /data/adb/modules/bindhosts/webroot/${fileName}`);
                    listElement.removeChild(listItem);
                }
            });
        }
        // Edit file
        if (editFile) {
            editFile.addEventListener("click", () => {
                const line = listItem.querySelector("span").textContent;
                fileNameEditor(line);
            });
        }
    });
    applyRippleEffect();
}

// Function to handle adding input to the file
async function handleAdd(fileType, prompt) {
    const inputElement = document.getElementById(`${fileType}-input`);
    const inputValue = inputElement.value.trim();
    console.log(`Input value for ${fileType}: "${inputValue}"`);
    if (inputValue === "") {
        console.error("Input is empty. Skipping add operation.");
        return;
    }
    const inputLines = inputValue.split('\n').map(line => line.trim()).filter(line => line !== "");
    try {
        const fileContent = await execCommand(`cat ${filePaths[fileType]}`);
        const existingLines = fileContent.split('\n').map(line => line.trim()).filter(line => line !== "");

        for (const line of inputLines) {
            if (existingLines.includes(line)) {
                console.log(`"${line}" is already in ${fileType}. Skipping add operation.`);
                showPrompt(prompt, false, 2000, `${line}`);
                continue;
            }
            await execCommand(`echo "${line}" >> ${filePaths[fileType]}`);
            console.log(`Added "${line}" to ${fileType} successfully.`);
        }

        inputElement.value = "";
        console.log(`Input box for ${fileType} cleared.`);
        loadFile(fileType);
    } catch (error) {
        console.error(`Failed to process input for ${fileType}: ${error}`);
    }
}

// Custom hosts file removal confirmation
function removeCustomHostsFile(fileName) {
    const confirmationOverlay = document.getElementById("confirmation-overlay");
    const cancelButton = document.getElementById("cancel-btn");
    const removeButton = document.getElementById("remove-btn");

    document.getElementById("confirmation-file-name").textContent = fileName;

    confirmationOverlay.style.display = "flex";
    setTimeout(() => {
        confirmationOverlay.style.opacity = "1";
    }, 10);

    const closeConfirmationOverlay = () => {
        confirmationOverlay.style.opacity = "0";
        setTimeout(() => {
            confirmationOverlay.style.display = "none";
        }, 200);
    }

    return new Promise((resolve) => {
        cancelButton.addEventListener("click", () => {
            closeConfirmationOverlay();
            resolve(false);
        });
        removeButton.addEventListener("click", () => {
            closeConfirmationOverlay();
            resolve(true);
        });
    });
}

// Help event listener
export let activeOverlay = null;
function setupHelpMenu() {
    const helpButtons = document.querySelectorAll(".help-btn");
    const overlays = document.querySelectorAll(".overlay");
    helpButtons.forEach(button => {
        button.addEventListener("click", () => {
            const type = button.dataset.type;
            const overlay = document.getElementById(`${type}-help`);
            if (overlay) {
                openOverlay(overlay);
            }
        });
    });
    overlays.forEach(overlay => {
        const closeButton = overlay.querySelector(".close-btn");
        const docsButtons = overlay.querySelector(".docs-btn");
        const languageContainer = document.getElementById('language-container');
        const language = document.getElementById('language-help');

        if (closeButton) closeButton.addEventListener("click", () => closeOverlay(overlay));
        if (docsButtons) docsButtons.addEventListener("click", () => closeOverlay(overlay));
        if (languageContainer) languageContainer.addEventListener('click', () => openOverlay(language));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeOverlay(overlay);
        });
    });
    function openOverlay(overlay) {
        if (activeOverlay) closeOverlay(activeOverlay);
        activeOverlay = overlay;
        overlay.style.display = "flex";
        document.body.style.overflow = "hidden";
        setTimeout(() => {
            overlay.style.opacity = "1";
        }, 10);
    }
    function closeOverlay(overlay) {
        activeOverlay = null;
        document.body.style.overflow = "";
        overlay.style.opacity = "0";
        setTimeout(() => {
            overlay.style.display = "none";
        }, 200);
    }
}

// Prevent input box blocked by keyboard
document.querySelectorAll('.input-box').forEach(input => {
    input.addEventListener('focus', event => {
        document.querySelector('.placeholder').classList.add('focused');
        const wrapper = event.target.closest('.input-box-wrapper');
        wrapper.classList.add('focus');
        const inputBox = wrapper.querySelector('.input-box');
        inputBox.style.paddingLeft = '9px';
        setTimeout(() => {
            const inputRect = event.target.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const keyboardHeight = viewportHeight * 0.6;
            const safeArea = 20;
            if (inputRect.bottom > (viewportHeight - keyboardHeight)) {
                const scrollAmount = inputRect.bottom - (viewportHeight - keyboardHeight) + safeArea;
                document.querySelector('.content').scrollBy({
                    top: scrollAmount,
                    behavior: 'smooth'
                });
            }
        }, 100);
    });
    input.addEventListener('blur', () => {
        document.querySelector('.placeholder').classList.remove('focused');
        const wrapper = input.closest('.input-box-wrapper');
        wrapper.classList.remove('focus');
        const inputBox = wrapper.querySelector('.input-box');
        inputBox.style.paddingLeft = '10px';
    });
});

// Attach event listeners to the add buttons
function attachAddButtonListeners() {
    const elements = [
        { id: "custom-input", type: "custom", fail: "custom.prompt_fail" },
        { id: "sources-input", type: "sources", fail: "source.prompt_fail" },
        { id: "blacklist-input", type: "blacklist", fail: "blacklist.prompt_fail" },
        { id: "whitelist-input", type: "whitelist", fail: "whitelist.prompt_fail" },
        { id: "sources_whitelist-input", type: "sources_whitelist", fail: "sources_whitelist.prompt_fail" }
    ];
    elements.forEach(({ id, type, fail }) => {
        const inputElement = document.getElementById(id);
        const buttonElement = document.getElementById(`${type}-add`);
        if (inputElement) {
            inputElement.addEventListener("keypress", (e) => {
                if (e.key === "Enter") handleAdd(type, fail);
            });
        }
        if (buttonElement) {
            buttonElement.addEventListener("click", () => handleAdd(type, fail));
        }
    });
}


/**
 * Action button click event
 * Run bindhosts.sh --action on click
 */
document.getElementById("actionButton").addEventListener("click", async () => {
    try {
        showPrompt("global.executing", true, 50000);
        await new Promise(resolve => setTimeout(resolve, 200));
            const command = "sh /data/adb/modules/bindhosts/bindhosts.sh --action";
            const output = await execCommand(command);
            const lines = output.split("\n");
            lines.forEach(line => {
                if (line.includes("[+] hosts file reset!")) {
                    showPrompt("global.reset", true, undefined, "[+]");
                } else if (line.includes("[+]")) {
                    showPrompt(line, true);
                } else if (line.includes("[x] unwritable")) {
                    showPrompt("global.unwritable", false, undefined, "[×]");
                } else if (line.includes("[x]")) {
                    showPrompt(line, false);
                } else if (line.includes("[*] not running")) {
                    showPrompt("global.disabled", false, undefined, "[*]");
                } else if (line.includes("[*] please reset")) {
                    showPrompt("global.adaway", false, undefined, "[*]");
                } else if (line.includes("[*]")) {
                    showPrompt(line, false);
                }
            });
    } catch (error) {
        showPrompt("global.execute_error", false, undefined, undefined, error);
        console.error("Failed to execute action script:", error);
    }
});

/**
 * Import custom hosts
 * File selector
 * File name editor
 * File editor (<128kB)
 */
const editorInput = document.getElementById("edit-input");
const fileNameInput = document.getElementById('file-name-input');
document.getElementById("import-custom-button").addEventListener("click", () => {
    openFileSelector();
});
export async function getCustomHostsList() {
    try {
        const output = await execCommand(`ls ${basePath} | grep "^custom.*\.txt$" | grep -vx "custom.txt"`);
        const lines = output.split("\n");
        displayHostsList(lines, "import_custom");
    } catch (error) {
        console.error("Failed to get custom hosts list:", error);
    }
}
async function fileNameEditor(fileName) {
    const rawFileName = fileName.replace("custom", "").replace(".txt", "");
    fileNameInput.value = rawFileName;
    try {
        await execCommand(`
            if [ $(wc -c < ${basePath}/${fileName}) -gt 131072 ]; then
                exit 1
            fi
            ln -sf ${basePath}/${fileName} /data/adb/modules/bindhosts/webroot/${fileName}
        `);
        const response = await fetch(`${fileName}`);
        editorInput.value = await response.text();
        openFileEditor(fileName);
    } catch (error) {
        // Only rename is supported when file is too large
        openFileEditor(fileName, false);
        showPrompt("global.file_too_large", true);
        console.error("Failed to get custom hosts list:", error);
    }
}
function openFileEditor(lastFileName, openEditor = true) {
    const header = document.querySelector('.title-container');
    const title = document.getElementById('title');
    const fileName = document.querySelector('.file-name-editor');
    const backButton = document.getElementById('edit-back-btn');
    const saveButton = document.getElementById('edit-save-btn');
    const actionButton = document.querySelector('.float');
    const editorCover = document.querySelector('.document-cover');
    const editor = document.getElementById('edit-content');
    const lineNumbers = document.querySelector('.line-numbers');
    const content = document.querySelector('.content');

    // Adjust width of fileName according to the length of text in input
    function adjustFileNameWidth() {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.fontFamily = window.getComputedStyle(fileNameInput).fontFamily;
        tempSpan.style.fontSize = '21px';
        tempSpan.textContent = fileNameInput.value;
        document.body.appendChild(tempSpan);
        if (tempSpan.offsetWidth <= window.innerWidth * 0.8 - 150) {
            fileNameInput.style.width = `${tempSpan.offsetWidth}px`;
        } else {
            fileNameInput.style.width = window.innerWidth * 0.8 - 150 + 'px';
        }
        document.body.removeChild(tempSpan);
    }
    adjustFileNameWidth();
    fileNameInput.addEventListener('input', adjustFileNameWidth);

    editorCover.style.opacity = '1';
    editorCover.style.pointerEvents = 'auto';
    header.classList.add('back');
    backButton.style.transform = 'translateX(0)';
    saveButton.style.transform = 'translateX(0)';
    actionButton.style.transform = 'translateY(110px)';
    title.style.display = 'none';
    fileName.style.display = 'flex';
    content.style.overflowY = 'hidden';

    // Open file editor
    if (openEditor) editor.style.transform = 'translateX(0)';
    else setTimeout(() => fileNameInput.focus(), 1000);

    // Set line numbers
    editorInput.addEventListener('input', () => {
        const lines = editorInput.value.split('\n').length;
        lineNumbers.innerHTML = Array.from({ length: lines }, (_, index) => 
            `<div>${(index + 1).toString().padStart(2, ' ')}</div>`
        ).join('');
        // Sync scroll position
        lineNumbers.scrollTop = editorInput.scrollTop;
    });
    editorInput.addEventListener('scroll', () => {
        lineNumbers.style.top = `-${editorInput.scrollTop}px`;
        // Sync scroll position
        lineNumbers.scrollTop = editorInput.scrollTop;
    });
    editorInput.dispatchEvent(new Event('input'));

    // Scroll to avoid keyboard blocking input box
    function scrollSafeInset() {
        editorInput.style.paddingBottom = '55vh';
        lineNumbers.style.paddingBottom = '55vh';
        setTimeout(() => {
            // Get cursor position
            const cursorPosition = editorInput.selectionStart;
            const textBeforeCursor = editorInput.value.substring(0, cursorPosition);
            const linesBeforeCursor = textBeforeCursor.split('\n').length;

            // Calculate cursor position using line height
            const lineHeight = parseFloat(window.getComputedStyle(editorInput).lineHeight);
            const cursorBottom = linesBeforeCursor * lineHeight;
            const viewportHeight = window.innerHeight;
            const keyboardHeight = viewportHeight * 0.6;
            const safeArea = 20;
            if (cursorBottom > (viewportHeight - keyboardHeight)) {
                const scrollAmount = cursorBottom - (viewportHeight - keyboardHeight) + safeArea;
                editorInput.scrollTo({
                    top: scrollAmount,
                    behavior: 'smooth'
                });
            }
        }, 100);
    }
    editorInput.addEventListener('input', scrollSafeInset);
    editorInput.addEventListener('blur', () => {
        editorInput.style.paddingBottom = '30px';
        lineNumbers.style.paddingBottom = '30px';
    });

    // Setup swipe to close if not set it yet
    let isSwipeToCloseSetup = false;
    if (!isSwipeToCloseSetup) {
        setupSwipeToClose(editor, editorCover, backButton);
        isSwipeToCloseSetup = true;
    }

    // Alternative way to close about docs with back button
    backButton.addEventListener('click', () => {
        if (openEditor) { editor.style.transform = 'translateX(100%)'; }
        editorInput.removeEventListener('input', scrollSafeInset);
        saveButton.removeEventListener('click', saveFile);
        editorCover.style.opacity = '0';
        editorCover.style.pointerEvents = 'none';
        backButton.style.transform = 'translateX(-100%)';
        header.classList.remove('back');
        title.style.display = 'block';
        actionButton.style.transform = 'translateY(0)';
        fileName.style.display = 'none';
        saveButton.style.transform = 'translateX(calc(105% + 15px))';
        content.style.overflowY = 'auto';
        document.querySelectorAll('.box li').forEach(li => {
            li.scrollTo({ left: 0, behavior: 'smooth' });
        });
        editorInput.scrollTo(0, 0);
    });

    // Save file
    async function saveFile() {
        const newFileName = fileNameInput.value;
        const content = editorInput.value.trim();
        if (newFileName === "") {
            showPrompt("global.file_name_empty", false);
            return;
        }
        try {
            if (openEditor) {
                await execCommand(`
                    [ ! -f ${basePath}/${lastFileName} ] || rm -f ${basePath}/${lastFileName}
                    cat << 'AUniqueEOF' > ${basePath}/custom${newFileName}.txt
${content}
AUniqueEOF
                    chmod 644 ${basePath}/custom${newFileName}.txt
                `);
                showPrompt("global.saved", true, undefined, undefined, `${basePath}/custom${newFileName}.txt`);
            } else {
                await execCommand(`mv -f ${basePath}/${lastFileName} ${basePath}/custom${newFileName}.txt`);
            }
            showPrompt("global.saved", true, undefined, undefined, `${basePath}/custom${newFileName}.txt`);
        } catch (error) {
            showPrompt("global.save_fail", false);
            console.error("Failed to save file:", error);
        }
        getCustomHostsList();
        backButton.click();
    }
    saveButton.addEventListener('click', saveFile);
}

window.replaceSpaces = function(input) {
    const cursorPosition = input.selectionStart;
    input.value = input.value.replace(/ /g, '_').replace(/[\/\0*?[\]{}|&$`"'\\<>]/g, '');
    input.setSelectionRange(cursorPosition, cursorPosition);
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    checkMMRL();
    initialTransition();
    loadTranslations();
    ["custom", "sources", "blacklist", "whitelist", "sources_whitelist"].forEach(loadFile);
    getCustomHostsList();
    attachAddButtonListeners();
    setupHelpMenu();
    applyRippleEffect();
});
