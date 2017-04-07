# CodeMirror-RevisedSearch
A revised interface for the default CodeMirror search addon, putting the find and replace fields in the same dialog as the buttons.

This is based on the original search addon included with CodeMirror, but with a revised interface.  Where the original falls back on the built in browser dialog if the dialog addon is not included, this relies on the "codemirror-advanceddialog" addon.  As a result it can render the find and replace fields in the same dialog as the buttons, as per most the search functionality found in many IDEs.

The editor should make room for the search dialog in order to prevent it from obscuring matches near the top of the document.

In addition, the dialog won't blur on close like the vanilla search, but instead closes either when the user clicks the "close" button or presses escape when either of the text boxes has focus.
