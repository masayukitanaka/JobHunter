import * as storageModule from "./storage";

const get = jest.fn();
const set = jest.fn();
const remove = jest.fn();
const sessionGet = jest.fn();
const sessionSet = jest.fn();
const sessionRemove = jest.fn();

global.chrome = {
  storage: {
    local: {
      set,
      get,
      remove
    },
    session: {
      get: sessionGet,
      set: sessionSet,
      remove: sessionRemove
    }
  }
};

const chromeGetStorageSpy = jest.spyOn(chrome.storage.local, 'get');
const chromeSetStorageSpy = jest.spyOn(chrome.storage.local, 'set');
const chromeRemoveStorageSpy = jest.spyOn(chrome.storage.local, 'remove');
const chromeGetSessionStorageSpy = jest.spyOn(chrome.storage.session, 'get');
const chromeSetSessionStorageSpy = jest.spyOn(chrome.storage.session, 'set');
const chromeRemoveSessionStorageSpy = jest.spyOn(chrome.storage.session, 'remove');

describe("storage → getStorage", () => {
  beforeEach(() => {
      jest.resetAllMocks();
  });

  test("chrome get storage api method called", () => {
    const getCallback = jest.fn();

    storageModule.getStorage("Test", getCallback);

    expect(chromeGetStorageSpy).toHaveBeenCalledWith(["Test"], expect.any(Function));
  });
});

describe("storage → setStorage", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    test("chrome set storage api method called", () => {
        storageModule.setStorage("Test", "Value");

        expect(chromeSetStorageSpy).toHaveBeenCalledWith({["Test"]: "Value"});
    });
});

describe("storage → removeStorage", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    test("chrome remove storage api method called", () => {
        storageModule.removeStorage("Test");

        expect(chromeRemoveStorageSpy).toHaveBeenCalledWith("Test");
    });
});

describe("storage → getSessionStorage / setSessionStorage / removeSessionStorage", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    test("chrome.storage.session get api method called", () => {
        const getCallback = jest.fn();
        storageModule.getSessionStorage("Test", getCallback);
        expect(chromeGetSessionStorageSpy).toHaveBeenCalledWith(["Test"], expect.any(Function));
    });

    test("chrome.storage.session set api method called", () => {
        storageModule.setSessionStorage("Test", "Value");
        expect(chromeSetSessionStorageSpy).toHaveBeenCalledWith({["Test"]: "Value"});
    });

    test("chrome.storage.session remove api method called", () => {
        storageModule.removeSessionStorage("Test");
        expect(chromeRemoveSessionStorageSpy).toHaveBeenCalledWith("Test");
    });
});
