// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// Revised search plugin written by Jamie Morris
// Define search commands. Depends on advanceddialog.js
((mod) => {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror"), require("codemirror-advanceddialog"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror", "codemirror-advanceddialog"], mod);
  else // Plain browser env
    mod(CodeMirror);
})((CodeMirror) => {
  "use strict";
  let numMatches = 0;
  let searchOverlay = (query, caseInsensitive) => {
    if (typeof query == "string")
      query = new RegExp(query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), caseInsensitive ? "gi" : "g");
    else if (!query.global)
      query = new RegExp(query.source, query.ignoreCase ? "gi" : "g");

    return {
      token: (stream) => {
        query.lastIndex = stream.pos;
        var match = query.exec(stream.string);
        if (match && match.index == stream.pos) {
          stream.pos += match[0].length || 1;
          return "searching";
        } else if (match) {
          stream.pos = match.index;
        } else {
          stream.skipToEnd();
        }
      }
    };
  }

  function SearchState() {
    this.posFrom = this.posTo = this.lastQuery = this.query = null;
    this.overlay = null;
  }

  let getSearchState = (cm) => {
    return cm.state.search || (cm.state.search = new SearchState());
  }

  let queryCaseInsensitive = (query) => {
    return typeof query == "string" && query == query.toLowerCase();
  }

  let getSearchCursor = (cm, query, pos) => {
    // Heuristic: if the query string is all lowercase, do a case insensitive search.
    return cm.getSearchCursor(query, pos, queryCaseInsensitive(query));
  }

  let persistentDialog = (cm, text, deflt, onEnter, onKeyDown) => {
    cm.openDialog(text, onEnter, {
      value: deflt,
      selectValueOnOpen: true,
      closeOnEnter: false,
      onClose: () => {
        clearSearch(cm);
      },
      onKeyDown: onKeyDown,
      closeOnBlur: cm.getOption("searchSettings") ? cm.getOption("searchSettings").closeOnBlur : true
    });
  }

  let dialog = (cm, text, shortText, deflt, f) => {
    if (cm.openDialog) cm.openDialog(text, f, {
      value: deflt,
      selectValueOnOpen: true,
      closeOnBlur: cm.getOption("searchSettings") ? cm.getOption("searchSettings").closeOnBlur : true
    });
    else f(prompt(shortText, deflt));
  }

  let confirmDialog = (cm, text, shortText, fs) => {
    if (cm.openConfirm) cm.openConfirm(text, fs, {
      closeOnBlur: cm.getOption("searchSettings") ? cm.getOption("searchSettings").closeOnBlur : true
    });
    else if (confirm(shortText)) fs[0]();
  }

  let parseString = (string) => {
    return string.replace(/\\(.)/g, (_, ch) => {
      if (ch == "n") return "\n"
      if (ch == "r") return "\r"
      return ch
    })
  }

  let parseQuery = (query) => {
    var isRE = query.indexOf('/') === 0 && query.lastIndexOf('/') === query.length - 1;
    if (!!isRE) {
      try {
        let matches = query.match(/^\/(.*)\/([a-z]*)$/);
        query = new RegExp(matches[1], matches[2].indexOf("i") == -1 ? "" : "i");
      } catch (e) {} // Not a regular expression after all, do a string search
    }
    if (typeof query == "string" ? query == "" : query.test(""))
      query = /x^/;
    return query;
  }

  let startSearch = (cm, state, query) => {
    state.queryText = query;
    state.query = parseQuery(query);
    cm.removeOverlay(state.overlay, queryCaseInsensitive(state.query));
    state.overlay = searchOverlay(state.query, queryCaseInsensitive(state.query));
    cm.addOverlay(state.overlay);
    if (cm.showMatchesOnScrollbar) {
      if (state.annotate) {
        state.annotate.clear();
        state.annotate = null;
      }
      state.annotate = cm.showMatchesOnScrollbar(state.query, queryCaseInsensitive(state.query));
    }
  }

  let findNext = (cm, reverse, callback) => {
    cm.operation(() => {
      var state = getSearchState(cm);
      var cursor = getSearchCursor(cm, state.query, reverse ? state.posFrom : state.posTo);
      if (!cursor.find(reverse)) {
        cursor = getSearchCursor(cm, state.query, reverse ? CodeMirror.Pos(cm.lastLine()) : CodeMirror.Pos(cm.firstLine(), 0));
        if (!cursor.find(reverse)) return;
      }
      cm.setSelection(cursor.from(), cursor.to());
      cm.scrollIntoView({
        from: cursor.from(),
        to: cursor.to()
      }, 20);
      state.posFrom = cursor.from();
      state.posTo = cursor.to();
      if (callback) callback(cursor.from(), cursor.to())
    });
  }

  let clearSearch = (cm) => {
    cm.operation(() => {
      var state = getSearchState(cm);
      state.lastQuery = state.query;
      if (!state.query) return;
      state.query = state.queryText = null;
      cm.removeOverlay(state.overlay);
      if (state.annotate) {
        state.annotate.clear();
        state.annotate = null;
      }
    });
  }

  var replaceDialog = `
    <div class="row find">
      <label for="CodeMirror-find-field">Replace:</label>
      <input id="CodeMirror-find-field" type="text" class="CodeMirror-search-field" placeholder="Find" />
      <span class="CodeMirror-search-hint">(Use /re/ syntax for regexp search)</span>
      <span id="CodeMirror-search-count"></span>
    </div>
    <div class="row replace">
      <label for="CodeMirror-replace-field">With:</label>
      <input id="CodeMirror-replace-field" type="text" class="CodeMirror-search-field" placeholder="Replace" />
    </div>
    <div class="buttons">
      <button>Find Previous</button>
      <button>Find Next</button>
      <button>Replace</button>
      <button>Replace All</button>
      <button>Close</button>
    </div>
  `;

  var findDialog = `
    <div class="row find">
      <label for="CodeMirror-find-field">Find:</label>
      <input id="CodeMirror-find-field" type="text" class="CodeMirror-search-field" placeholder="Find" />
      <span class="CodeMirror-search-hint">(Use /re/ syntax for regexp search)</span>
      <span id="CodeMirror-search-count"></span>
    </div>
    <div class="buttons">
      <button>Find Previous</button>
      <button>Find Next</button>
      <button>Close</button>
    </div>
  `;

  let replaceAll = (cm, query, text) => {
    cm.operation(() => {
      for (var cursor = getSearchCursor(cm, query); cursor.findNext();) {
        if (typeof query != "string") {
          var match = cm.getRange(cursor.from(), cursor.to()).match(query);
          cursor.replace(text.replace(/\$(\d)/g, (_, i) => {
            return match[i];
          }));
        } else cursor.replace(text);
      }
    });
  }

  let replaceNext = (cm, query, text) => {
    var cursor = getSearchCursor(cm, query, cm.getCursor("from"));
    var start = cursor.from(),
      match;
    if (!(match = cursor.findNext())) {
      cursor = getSearchCursor(cm, query);
      if (!(match = cursor.findNext()) ||
        (start && cursor.from().line == start.line && cursor.from().ch == start.ch)) return;
    }
    cm.setSelection(cursor.from(), cursor.to());
    cm.scrollIntoView({
      from: cursor.from(),
      to: cursor.to()
    });
    cursor.replace(typeof query == "string" ? text :
      text.replace(/\$(\d)/g, (_, i) => {
        return match[i];
      }));
  }


  let doSearch = (cm, query, reverse) => {
    var hiding = null;
    var state = getSearchState(cm);
    if (query != state.queryText) {
      startSearch(cm, state, query);
      state.posFrom = state.posTo = cm.getCursor();
    }
    findNext(cm, (reverse || false));
  }

  let getFindBehaviour = (cm, defaultText, callback) => {
    if (!defaultText) {
      defaultText = '';
    }
    let behaviour = {
      value: defaultText,
      focus: true,
      selectValueOnOpen: true,
      closeOnEnter: false,
      closeOnBlur: false,
      callback: (inputs, e) => {
        let query = inputs[0].value;
        if (!query) return;
        doSearch(cm, query, !!e.shiftKey);
      }
    };
    if (!!callback) {
      behaviour.callback = callback;
    }
    return behaviour;
  }

  let getFindPrevBtnBehaviour = (cm) => {
    return {
      callback: (inputs) => {
        let query = inputs[0].value;
        if (!query) return;
        doSearch(cm, query, true);
      }
    }
  };

  let getFindNextBtnBehaviour = (cm) => {
    return {
      callback: (inputs) => {
        let query = inputs[0].value;
        if (!query) return;
        doSearch(cm, query, false);
      }
    }
  };

  let closeBtnBehaviour = {
    callback: null
  };

  let countMatches = () => {

  };

  let find = (cm) => {
    if (cm.getOption("readOnly")) return;
    clearSearch(cm);
    var query = cm.getSelection() || getSearchState(cm).lastQuery;
    let closeDialog = cm.openAdvancedDialog(findDialog, {
      shrinkEditor: true,
      inputBehaviours: [
        getFindBehaviour(cm, query)
      ],
      buttonBehaviours: [
        getFindPrevBtnBehaviour(cm),
        getFindNextBtnBehaviour(cm),
        closeBtnBehaviour
      ]
    });

    let closeFindDialogOnReadOnly = (cm, opt) => {
      if (opt === "readOnly" && !!cm.getOption("readOnly")) {
        closeDialog();
        cm.off("optionChange", closeFindDialogOnReadOnly);
      }
    };

    cm.on("optionChange", closeFindDialogOnReadOnly);
  }

  let replace = (cm, all) => {
    if (cm.getOption("readOnly")) return;
    clearSearch(cm);

    let replaceNextCallback = (inputs) => {
      let query = parseQuery(inputs[0].value);
      let text = parseString(inputs[1].value);
      if (!query) return;
      replaceNext(cm, query, text);
      doSearch(cm, query);
    };

    var query = cm.getSelection() || getSearchState(cm).lastQuery;
    let closeDialog = cm.openAdvancedDialog(replaceDialog, {
      shrinkEditor: true,
      inputBehaviours: [
        getFindBehaviour(cm, query, (inputs) => {
          inputs[1].focus();
          inputs[1].select();
        }),
        {
          closeOnEnter: false,
          closeOnBlur: false,
          callback: replaceNextCallback
        }
      ],
      buttonBehaviours: [
        getFindPrevBtnBehaviour(cm),
        getFindNextBtnBehaviour(cm),
        {
          callback: replaceNextCallback
        },
        {
          callback: (inputs) => {
            // Replace all
            let query = parseQuery(inputs[0].value);
            let text = parseString(inputs[1].value);
            if (!query) return;
            replaceAll(cm, query, text);
          }
        },
        closeBtnBehaviour
      ]
    });

    let closeFindDialogOnReadOnly = (cm, opt) => {
      if (opt === "readOnly" && !!cm.getOption("readOnly")) {
        closeDialog();
        cm.off("optionChange", closeFindDialogOnReadOnly);
      }
    };

    cm.on("optionChange", closeFindDialogOnReadOnly);
  }

  CodeMirror.commands.find = find;
  CodeMirror.commands.replace = replace;
});