import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from '../components/ImageNodeView';

export interface CustomImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customImage: {
      /**
       * Add an image with custom imageId and width
       */
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        imageId?: number | string;
        width?: string;
      }) => ReturnType;
    };
  }
}

export const CustomImage = Node.create<CustomImageOptions>({
  name: 'image',

  addOptions() {
    return {
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: (attributes) => {
          if (!attributes.src) {
            return {};
          }
          return {
            src: attributes.src,
          };
        },
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute('alt'),
        renderHTML: (attributes) => {
          if (!attributes.alt) {
            return {};
          }
          return {
            alt: attributes.alt,
          };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) => {
          if (!attributes.title) {
            return {};
          }
          return {
            title: attributes.title,
          };
        },
      },
      imageId: {
        default: null,
        parseHTML: (element) => {
          const id = element.getAttribute('data-image-id');
          return id ? (isNaN(Number(id)) ? id : Number(id)) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.imageId) {
            return {};
          }
          return {
            'data-image-id': attributes.imageId,
          };
        },
      },
      width: {
        default: '100%',
        parseHTML: (element) => {
          return element.getAttribute('data-width') || element.getAttribute('width') || element.style.width || '100%';
        },
        renderHTML: (attributes) => {
          if (!attributes.width || attributes.width === '100%') {
            return {
              'data-width': '100%',
              style: 'width: 100%; max-width: 100%; height: auto;',
            };
          }
          return {
            'data-width': attributes.width,
            width: attributes.width,
            style: `width: ${attributes.width}; max-width: 100%; height: auto;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
