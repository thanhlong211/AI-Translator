const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openSelector: (options) => {
    return ipcRenderer.invoke(
      "open-selector",
      options
    );
  },


  translatePanel: (options) => {
    return ipcRenderer.invoke(
      "translation:panel",
      options
    );
  },


  translatePanelNextPage: () => {
    return ipcRenderer.invoke(
      "translation:panel-next"
    );
  },


  setMangaContinuousMode: (enabled) => {
    return ipcRenderer.invoke(
      "translation:manga-continuous-toggle",
      Boolean(enabled)
    );
  },

  toggleMangaContinuousPause: () => {
    return ipcRenderer.invoke(
      "translation:manga-continuous-pause"
    );
  },

  getFeatureCapabilities: () => {
    return ipcRenderer.invoke(
      "translation:feature-capabilities"
    );
  },

  getMangaPanelSessionState: () => {
    return ipcRenderer.invoke(
      "translation:manga-session-state"
    );
  },

  endMangaPanelSession: () => {
    return ipcRenderer.invoke(
      "translation:manga-session-end"
    );
  },

  getMangaPanelSessionDetails: () => {
    return ipcRenderer.invoke(
      "translation:manga-session-details"
    );
  },

  resetMangaPanelSessionChapter: () => {
    return ipcRenderer.invoke(
      "translation:manga-session-reset-chapter"
    );
  },

  toggleMangaSessionInspector: () => {
    return ipcRenderer.invoke(
      "translation:manga-session-inspector-toggle"
    );
  },

  closeMangaSessionInspector: () => {
    return ipcRenderer.invoke(
      "translation:manga-session-inspector-close"
    );
  },

  onMangaSessionInspectorRefresh: (callback) => {
    const listener =
      () => {
        callback();
      };

    ipcRenderer.on(
      "manga-session-inspector-refresh",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "manga-session-inspector-refresh",
        listener
      );
    };
  },

  translateFullScreen: (options) => {
    return ipcRenderer.invoke(
      "translation:full-screen",
      options
    );
  },


  getFullScreenOverlayState: () => {
    return ipcRenderer.invoke(
      "full-screen-overlay:get-state"
    );
  },

  getFullScreenOverlayPayload: () => {
    return ipcRenderer.invoke(
      "full-screen-overlay:get-payload"
    );
  },

  toggleFullScreenOverlayPin: () => {
    return ipcRenderer.invoke(
      "full-screen-overlay:toggle-pin"
    );
  },

  toggleFullScreenOverlayEditMode: () => {
    return ipcRenderer.invoke(
      "full-screen-overlay:toggle-edit"
    );
  },

  toggleFullScreenOverlayDebug: () => {
    return ipcRenderer.invoke(
      "full-screen-overlay:toggle-debug"
    );
  },

  setFullScreenOverlayTextInputActive: (active) => {
    return ipcRenderer.invoke(
      "full-screen-overlay:set-text-input-active",
      Boolean(active)
    );
  },

  resetFullScreenOverlayLayout: () => {
    return ipcRenderer.invoke(
      "full-screen-overlay:reset-layout"
    );
  },

  saveFullScreenOverlayCorrection: (correction) => {
    return ipcRenderer.invoke(
      "full-screen-overlay:save-correction",
      correction
    );
  },

  closeFullScreenOverlay: () => {
    ipcRenderer.send(
      "full-screen-overlay:close"
    );
  },

  onFullScreenOverlayState: (callback) => {
    const listener =
      (_event, state) => {
        callback(state);
      };

    ipcRenderer.on(
      "full-screen-overlay-state",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "full-screen-overlay-state",
        listener
      );
    };
  },

  onFullScreenOverlayItems: (callback) => {
    const listener =
      (_event, payload) => {
        callback(payload);
      };

    ipcRenderer.on(
      "full-screen-overlay-items",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "full-screen-overlay-items",
        listener
      );
    };
  },

  onFullScreenOverlayResetLayout: (callback) => {
    const listener =
      () => {
        callback();
      };

    ipcRenderer.on(
      "full-screen-overlay-reset-layout",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "full-screen-overlay-reset-layout",
        listener
      );
    };
  },

  onFullScreenOverlayPreferences: (callback) => {
    const listener =
      (_event, preferences) => {
        callback(preferences);
      };

    ipcRenderer.on(
      "full-screen-overlay-preferences",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "full-screen-overlay-preferences",
        listener
      );
    };
  },


  openStudySelector: (options) => {
    return ipcRenderer.invoke(
      "study:open-selector",
      options
    );
  },

  setWorkspaceMode: (mode) => {
    return ipcRenderer.invoke(
      "workspace:set-mode",
      mode
    );
  },

  setTranslationLanguages: (options) => {
    return ipcRenderer.invoke(
      "translation:set-languages",
      options
    );
  },

  setStudyLevel: (level) => {
    return ipcRenderer.invoke(
      "study:set-level",
      level
    );
  },


  setStudyAutoSaveVocabulary: (
    value
  ) => {
    return ipcRenderer.invoke(
      "study:set-auto-save-vocabulary",
      value
    );
  },


  setStudyAutoSaveGrammar: (
    value
  ) => {
    return ipcRenderer.invoke(
      "study:set-auto-save-grammar",
      value
    );
  },


  setWorkspaceScanGuard: (reason) => {
    return ipcRenderer.invoke(
      "workspace:set-scan-guard",
      reason
    );
  },

  getBackendStatus: () => {
    return ipcRenderer.invoke(
      "backend:get-status"
    );
  },

  getBackendConfig: () => {
    return ipcRenderer.invoke(
      "backend:get-config"
    );
  },


  getAuthStatus: () => {
    return ipcRenderer.invoke(
      "auth:get-status"
    );
  },

  login: (credentials) => {
    return ipcRenderer.invoke(
      "auth:login",
      credentials
    );
  },

  register: (credentials) => {
    return ipcRenderer.invoke(
      "auth:register",
      credentials
    );
  },

  refreshSession: () => {
    return ipcRenderer.invoke(
      "auth:refresh"
    );
  },

  logout: () => {
    return ipcRenderer.invoke(
      "auth:logout"
    );
  },

  getDevices: () => {
    return ipcRenderer.invoke(
      "auth:get-devices"
    );
  },

  revokeDevice: (sessionId) => {
    return ipcRenderer.invoke(
      "auth:revoke-device",
      sessionId
    );
  },

  onAuthChanged: (callback) => {
    const listener =
      (_event, data) => {
        callback(data);
      };

    ipcRenderer.on(
      "auth-changed",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "auth-changed",
        listener
      );
    };
  },


  listProfiles: () => {
    return ipcRenderer.invoke(
      "profiles:list"
    );
  },

  createProfile: (profile) => {
    return ipcRenderer.invoke(
      "profiles:create",
      profile
    );
  },

  updateProfile: (
    profileId,
    profile
  ) => {
    return ipcRenderer.invoke(
      "profiles:update",
      profileId,
      profile
    );
  },

  deleteProfile: (profileId) => {
    return ipcRenderer.invoke(
      "profiles:delete",
      profileId
    );
  },

  setDefaultProfile: (profileId) => {
    return ipcRenderer.invoke(
      "profiles:set-default",
      profileId
    );
  },

  setActiveTranslationProfile: (
    profile
  ) => {
    return ipcRenderer.invoke(
      "translation:set-active-profile",
      profile
    );
  },

  clearTranslationContext: (
    profileId
  ) => {
    return ipcRenderer.invoke(
      "translation:clear-context",
      profileId
    );
  },


  listVocabulary: (filters) => {
    return ipcRenderer.invoke(
      "vocabulary:list",
      filters
    );
  },

  getVocabularyStats: () => {
    return ipcRenderer.invoke(
      "vocabulary:stats"
    );
  },

  saveVocabulary: (item) => {
    return ipcRenderer.invoke(
      "vocabulary:save",
      item
    );
  },

  updateVocabulary: (
    vocabularyId,
    patch
  ) => {
    return ipcRenderer.invoke(
      "vocabulary:update",
      vocabularyId,
      patch
    );
  },

  deleteVocabulary: (
    vocabularyId
  ) => {
    return ipcRenderer.invoke(
      "vocabulary:delete",
      vocabularyId
    );
  },


  listGrammar: (filters) => {
    return ipcRenderer.invoke(
      "grammar:list",
      filters
    );
  },

  getGrammarStats: () => {
    return ipcRenderer.invoke(
      "grammar:stats"
    );
  },

  saveGrammar: (item) => {
    return ipcRenderer.invoke(
      "grammar:save",
      item
    );
  },

  updateGrammar: (
    grammarId,
    patch
  ) => {
    return ipcRenderer.invoke(
      "grammar:update",
      grammarId,
      patch
    );
  },

  deleteGrammar: (
    grammarId
  ) => {
    return ipcRenderer.invoke(
      "grammar:delete",
      grammarId
    );
  },


  getReviewQueue: (
    limit
  ) => {
    return ipcRenderer.invoke(
      "review:due",
      limit
    );
  },

  getPracticeReviewQueue: (
    limit
  ) => {
    return ipcRenderer.invoke(
      "review:practice",
      limit
    );
  },

  getReviewStats: () => {
    return ipcRenderer.invoke(
      "review:stats"
    );
  },

  answerReviewItem: (
    answer
  ) => {
    return ipcRenderer.invoke(
      "review:answer",
      answer
    );
  },


  getLearningDashboard: () => {
    return ipcRenderer.invoke(
      "learning:dashboard"
    );
  },

  getShortcutSettings: () => {
    return ipcRenderer.invoke(
      "shortcuts:get"
    );
  },

  updateShortcutSettings: (
    shortcuts
  ) => {
    return ipcRenderer.invoke(
      "shortcuts:update",
      shortcuts
    );
  },


  getAppPreferences: () => {
    return ipcRenderer.invoke(
      "app-preferences:get"
    );
  },

  updateAppPreferences: (
    preferences
  ) => {
    return ipcRenderer.invoke(
      "app-preferences:update",
      preferences
    );
  },

  resetAppPreferences: () => {
    return ipcRenderer.invoke(
      "app-preferences:reset"
    );
  },

  getTranslationOverlayState: () => {
    return ipcRenderer.invoke(
      "translation-overlay:get-state"
    );
  },

  toggleTranslationOverlayPin: () => {
    return ipcRenderer.invoke(
      "translation-overlay:toggle-pin"
    );
  },

  closeTranslationOverlay: () => {
    ipcRenderer.send(
      "translation-overlay:close"
    );
  },

  onTranslationOverlayPreferences: (
    callback
  ) => {
    const listener =
      (_event, preferences) => {
        callback(
          preferences
        );
      };

    ipcRenderer.on(
      "translation-overlay-preferences",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "translation-overlay-preferences",
        listener
      );
    };
  },

  onTranslationOverlayState: (
    callback
  ) => {
    const listener =
      (_event, state) => {
        callback(state);
      };

    ipcRenderer.on(
      "translation-overlay-state",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "translation-overlay-state",
        listener
      );
    };
  },

  sendSelection: (data) => {
    ipcRenderer.send("selection-complete", data);
  },

  onScanResult: (callback) => {
    const listener = (_event, result) => {
      callback(result);
    };

    ipcRenderer.on("scan-result", listener);

    return () => {
      ipcRenderer.removeListener("scan-result", listener);
    };
  },


  onStudyFastResult: (callback) => {
    const listener =
      (_event, result) => {
        callback(result);
      };

    ipcRenderer.on(
      "study-fast-result",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "study-fast-result",
        listener
      );
    };
  },

  onStudyResult: (callback) => {
    const listener =
      (_event, result) => {
        callback(result);
      };

    ipcRenderer.on(
      "study-result",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "study-result",
        listener
      );
    };
  },
  onSelectionTranslation: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on("selection-translation", listener);

    return () => {
      ipcRenderer.removeListener("selection-translation", listener);
    };
  },
  onTranslationOverlay: (callback) => {
    ipcRenderer.on("translation-overlay", (_event, data) => {
      callback(data);
    });
  },
  onTranslationOverlayItems: (callback) => {
    const listener = (_event, items) => {
      callback(items);
    };

    ipcRenderer.on("translation-overlay-items", listener);

    return () => {
      ipcRenderer.removeListener("translation-overlay-items", listener);
    };
  },
});
