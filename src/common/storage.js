export const getStorage = (componentKey, callback) => {
    chrome.storage.local.get([componentKey], function(result) {
        callback(result[componentKey]);
    });
};

export const setStorage = (componentKey, value) => {
    chrome.storage.local.set({[componentKey]: value});
};

export const removeStorage = (componentKey) => {
    chrome.storage.local.remove(componentKey);
};

// chrome.storage.session: cleared when the browser closes, not synced, and
// not persisted to disk — used for short-lived handoffs between an
// injected content script and a popup that may be closed and reopened in
// between (see docs/SPEC.md §7.3, the element picker result).
export const getSessionStorage = (componentKey, callback) => {
    chrome.storage.session.get([componentKey], function(result) {
        callback(result[componentKey]);
    });
};

export const setSessionStorage = (componentKey, value) => {
    chrome.storage.session.set({[componentKey]: value});
};

export const removeSessionStorage = (componentKey) => {
    chrome.storage.session.remove(componentKey);
};
