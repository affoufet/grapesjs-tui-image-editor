export default (editor, options = {}) => {
  const remoteIcons = 'https://raw.githubusercontent.com/nhnent/tui.image-editor/production/dist/svg/';
  const opts = { ...{
    // TOAST UI's configurations
    // http://nhnent.github.io/tui.image-editor/latest/ImageEditor.html
    config: {},

    // Pass the editor constructor. By default, the `tui.ImageEditor` will be called
    constructor: '',

    // Label for the image editor (used in the modal)
    labelImageEditor: 'Image Editor',

    // Label used on the apply button
    labelApply: 'Apply',

    // Default editor height
    height: '650px',

    // Default editor width
    width: '100%',

    // Hide the default editor header
    hideHeader: 1,

    // By default, GrapesJS takes the modified image, adds it to the Asset Manager and update the target.
    // If you need some custom logic you can use this custom 'onApply' function
    // eg.
    // onApply: (imageEditor, imageModel) => {
    //   const dataUrl = imageEditor.toDataURL();
    //   editor.AssetManager.add({ src: dataUrl }); // Add it to Assets
    //   imageModel.set('src', dataUrl); // Update the image component
    // }
    onApply: 0,

    // If no custom `onApply` is passed and this option is `true`, the result image will be added to assets
    addToAssets: 1,

    // If no custom `onApply` is passed, on confirm, the edited image, will be passed to the AssetManager's
    // uploader and the result (eg. instead of having the dataURL you'll have the URL) will be
    // passed to the default `onApply` process (update target, etc.)
    upload: 0,

    // The apply button (HTMLElement) will be passed as an argument to this function, once created.
    // This will allow you a higher customization.
    onApplyButton: () => {},

    // The TOAST UI editor isn't compiled with icons, so generally, you should download them and indicate
    // the local path in the `includeUI.theme` configurations.
    // Use this option to change them or set it to `false` to keep what is come in `includeUI.theme`
    // By default, the plugin will try to use the editor's remote icons (which involves a cross-origin async
    // request, indicated as unsafe by most of the browsers)
    icons: {
      'menu.normalIcon.path': `${remoteIcons}icon-d.svg`,
      'menu.activeIcon.path': `${remoteIcons}icon-b.svg`,
      'menu.disabledIcon.path': `${remoteIcons}icon-a.svg`,
      'menu.hoverIcon.path': `${remoteIcons}icon-c.svg`,
      'submenu.normalIcon.path': `${remoteIcons}icon-d.svg`,
      'submenu.activeIcon.path': `${remoteIcons}icon-c.svg`,
    },

    // Script to load dynamically in case no TOAST UI editor instance was found
    script: [
        'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/1.6.7/fabric.js',
        'https://uicdn.toast.com/tui.code-snippet/v1.5.0/tui-code-snippet.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js',
        'https://uicdn.toast.com/tui-color-picker/v2.2.0/tui-color-picker.js',
        'https://uicdn.toast.com/tui-image-editor/latest/tui-image-editor.js'
      ],

    // In case the script is loaded this style will be loaded too
    style: [
      'https://uicdn.toast.com/tui-color-picker/v2.2.0/tui-color-picker.css',
      'https://uicdn.toast.com/tui-image-editor/latest/tui-image-editor.css'
    ],
  },  ...options };

  const { script, style, height, width, hideHeader, icons, onApply, upload, addToAssets } = opts;
  const getConstructor = () => opts.constructor || (window.tui && window.tui.ImageEditor);
  let constr = getConstructor();

  // Dynamic loading of the image editor scripts and styles
  if (!constr && script) {
    const { head } = document;
    const scripts = Array.isArray(script) ? [...script] : [script];
    const styles = Array.isArray(style) ? [...style] : [style];
    const appendStyle = styles => {
      if (styles.length) {
        const link = document.createElement('link');
        link.href = styles.shift();
        link.rel = 'stylesheet';
        head.appendChild(link);
        appendStyle(styles);
      }
    }
    const appendScript = scripts => {
      if (scripts.length) {
        const scr = document.createElement('script');
        scr.src = scripts.shift();
        scr.onerror = scr.onload = appendScript.bind(null, scripts);
        head.appendChild(scr);
      } else {
        constr = getConstructor();
      }
    }
    appendStyle(styles);
    appendScript(scripts);
  }


  editor.Commands.add('image-editor', {
    run(ed, s, options = {}) {
      this.editor = ed;
      this.target = options.target || ed.getSelected();
      const content = this.createContent();
      const title = opts.labelImageEditor;
      const btn = content.children[1];
      this.imageEditor = new constr(content.children[0], this.getEditorConfig());
      ed.Modal.open({ title, content })
        .getModel().once('change:open', () => editor.stopCommand(this.id));
      ed.getModel().setEditing(1);
      btn.onclick = () => this.applyChanges();
      opts.onApplyButton(btn);
    },

    stop(ed) {
      const { imageEditor } = this;
      imageEditor && imageEditor.destroy();
      ed.getModel().setEditing(0);
    },

    getEditorConfig() {
      const config = { ...opts.config };
      const path = this.target.get('src');

      if (!config.includeUI) config.includeUI = {};
      config.includeUI = {
        theme: {},
        ...config.includeUI,
        loadImage: { path, name: 1 },
        uiSize: { height, width },
      };
      if (hideHeader) config.includeUI.theme['header.display'] = 'none';
      if (icons) config.includeUI.theme = {
        ...config.includeUI.theme,
        ...icons,
      }

      return config;
    },

    createContent() {
      const content = document.createElement('div');
      content.style = 'position: relative';
      content.innerHTML = `
        <div></div>
        <button class="tui-image-editor__apply-btn" style="
          position: absolute;
          top: 0; right: 0;
          margin: 10px;
          background-color: #fff;
          font-size: 1rem;
          border-radius: 3px;
          border: none;
          padding: 10px 20px;
          cursor: pointer
        ">
          ${opts.labelApply}
        </botton>
      `;

      return content;
    },

    applyChanges() {
      const { imageEditor, target, editor } = this;
      const { AssetManager } = editor;

      if (onApply) {
        onApply(imageEditor, target);
      } else {
        const dataURL = imageEditor.toDataURL();

        if (upload) {
          const file = this.dataUrlToBlob(dataURL);
          AssetManager.FileUploader().uploadFile({
            dataTransfer: { files: [file] }
          }, res => {
            const obj = res && res.data && res.data[0];
            const src = obj && (typeof obj === 'string' ? obj : obj.src);
            src && this.applyToTarget(src);
          });
        } else {
          addToAssets && AssetManager.add({
            src: dataURL,
            name: (target.get('src') || '').split('/').pop(),
          });
          this.applyToTarget(dataURL);
        }
      }
    },

    applyToTarget(result) {
      this.target.set({ src: result });
      this.editor.Modal.close();
    },

    dataUrlToBlob(dataURL) {
      const data = dataURL.split(',');
      const byteStr = window.atob(data[1]);
      const type = data[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteStr.length; i++) {
          ia[i] = byteStr.charCodeAt(i);
      }

      return new Blob([ab], { type });
    },
  });
};
