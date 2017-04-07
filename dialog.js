// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
// Advanced dialog plugin written by Jamie Morris
// Open advanced dialogs on top of an editor. Relies on dialog.css.

(function (mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})((CodeMirror) => {
    let dialogDiv = (cm, template, bottom) => {
        let dialog = cm.getWrapperElement().appendChild(document.createElement("div"));
        if (bottom) {
            dialog.className = "CodeMirror-dialog CodeMirror-dialog-bottom";
        }
        else {
            dialog.className = "CodeMirror-dialog CodeMirror-dialog-top";
        }

        if (typeof template == "string") {
            dialog.innerHTML = template;
        } else { // Assuming it's a detached DOM element.
            dialog.appendChild(template);
        }
        return dialog;
    }

    let closeNotification = (cm, newVal) => {
        if (cm.state.currentNotificationClose) {
            cm.state.currentNotificationClose();
        }
        cm.state.currentNotificationClose = newVal;
    }

    CodeMirror.defineExtension("openAdvancedDialog", function (template, options) {
        if (!options) options = {};

        let closed = false;
        let close = () => {
            if (options.shrinkEditor) {
                wrapper.style.removeProperty('margin-top');
                wrapper.style.removeProperty('height');
            }
            if (closed) return;
            closed = true;
            dialog.parentNode.removeChild(dialog);
            this.focus();

            if (options.onClose) options.onClose(dialog);

        }

        closeNotification(this, close);

        let dialog = dialogDiv(this, template, options.bottom);
        let dialogHeight = (dialog.offsetHeight + 10);

        let wrapper;
        if (options.shrinkEditor) {
            wrapper = this.display.wrapper.querySelector('.CodeMirror-scroll');
            let wrapperHeight = window.getComputedStyle(wrapper).getPropertyValue('height');
            wrapper.style.height = (parseInt(wrapperHeight) - dialogHeight) + 'px';
            wrapper.style.marginTop = (wrapper.style.marginTop || 0) + dialogHeight + 'px';
        }

        let inputs = dialog.getElementsByTagName("input");
        let buttons = dialog.getElementsByTagName("button");
        if (inputs && inputs.length > 0 && options.inputBehaviours) {
            for (let i = 0; i < options.inputBehaviours.length; i++) {
                let behaviour = options.inputBehaviours[i];
                let input = inputs[i];
                if (behaviour.value) {
                    input.value = behaviour.value;
                }

                if (!!behaviour.focus) {
                    input.focus();
                }
                if (!!behaviour.selectValueOnOpen) {
                    input.select();
                }
                if (behaviour.onInput) {
                    CodeMirror.on(input, "input", (e) => { behaviour.onInput(e, input.value, close); });
                }
                if (behaviour.onKeyUp) {
                    CodeMirror.on(input, "keyup", (e) => { behaviour.onKeyUp(e, input.value, close); });
                }
                CodeMirror.on(input, "keydown", (e) => {
                    if (behaviour.onKeyDown && behaviour.onKeyDown(e, input.value, close)) { return; }
                    if (e.keyCode === 27 || (!!behaviour.closeOnEnter && e.keyCode === 13)) {
                        input.blur();
                        CodeMirror.e_stop(e);
                        close();
                    }
                    else if (e.keyCode === 13 && behaviour.callback) {
                        behaviour.callback(inputs, e);
                    }
                });
                if (behaviour.closeOnBlur !== false) CodeMirror.on(input, "blur", close);
            }
        }

        if (buttons && buttons.length > 0 && options.buttonBehaviours) {
            for (let i = 0; i < options.buttonBehaviours.length; i++) {
                let behaviour = options.buttonBehaviours[i];
                if (!!behaviour.callback) {
                    CodeMirror.on(buttons[i], "click", (e) => {
                        behaviour.callback(inputs, e);
                    });
                } else {
                    CodeMirror.on(buttons[i], "click", () => {
                        close();
                        this.focus();
                    });
                }
            }
        }
        return close;
    });
});
