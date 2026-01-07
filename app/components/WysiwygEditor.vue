<template>
  <div class="wysiwyg-editor">
    <!-- Toolbar -->
    <div
      v-if="editor"
      class="flex items-center gap-1 p-2 bg-bg-tertiary border border-border rounded-t border-b-0"
    >
      <!-- Text Formatting -->
      <button
        type="button"
        @click="editor.chain().focus().toggleBold().run()"
        :class="['toolbar-btn', { active: editor.isActive('bold') }]"
        title="Bold"
      >
        <Icon name="ph:text-b-bold" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleItalic().run()"
        :class="['toolbar-btn', { active: editor.isActive('italic') }]"
        title="Italic"
      >
        <Icon name="ph:text-italic" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleStrike().run()"
        :class="['toolbar-btn', { active: editor.isActive('strike') }]"
        title="Strikethrough"
      >
        <Icon name="ph:text-strikethrough" />
      </button>

      <div class="w-px h-5 bg-border mx-1"></div>

      <!-- Headings -->
      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        :class="[
          'toolbar-btn',
          { active: editor.isActive('heading', { level: 1 }) },
        ]"
        title="Heading 1"
      >
        <Icon name="ph:text-h-one" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        :class="[
          'toolbar-btn',
          { active: editor.isActive('heading', { level: 2 }) },
        ]"
        title="Heading 2"
      >
        <Icon name="ph:text-h-two" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        :class="[
          'toolbar-btn',
          { active: editor.isActive('heading', { level: 3 }) },
        ]"
        title="Heading 3"
      >
        <Icon name="ph:text-h-three" />
      </button>

      <div class="w-px h-5 bg-border mx-1"></div>

      <!-- Lists -->
      <button
        type="button"
        @click="editor.chain().focus().toggleBulletList().run()"
        :class="['toolbar-btn', { active: editor.isActive('bulletList') }]"
        title="Bullet List"
      >
        <Icon name="ph:list-bullets" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleOrderedList().run()"
        :class="['toolbar-btn', { active: editor.isActive('orderedList') }]"
        title="Numbered List"
      >
        <Icon name="ph:list-numbers" />
      </button>

      <div class="w-px h-5 bg-border mx-1"></div>

      <!-- Block -->
      <button
        type="button"
        @click="editor.chain().focus().toggleBlockquote().run()"
        :class="['toolbar-btn', { active: editor.isActive('blockquote') }]"
        title="Quote"
      >
        <Icon name="ph:quotes" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleCodeBlock().run()"
        :class="['toolbar-btn', { active: editor.isActive('codeBlock') }]"
        title="Code Block"
      >
        <Icon name="ph:code" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().setHorizontalRule().run()"
        class="toolbar-btn"
        title="Horizontal Rule"
      >
        <Icon name="ph:minus" />
      </button>

      <div class="w-px h-5 bg-border mx-1"></div>

      <!-- Color Picker -->
      <div class="relative">
        <input
          type="color"
          @input="setColor($event)"
          class="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
          title="Text Color"
        />
      </div>

      <div class="flex-1"></div>

      <!-- Clear Formatting -->
      <button
        type="button"
        @click="editor.chain().focus().unsetAllMarks().clearNodes().run()"
        class="toolbar-btn"
        title="Clear Formatting"
      >
        <Icon name="ph:eraser" />
      </button>

      <!-- Undo/Redo -->
      <button
        type="button"
        @click="editor.chain().focus().undo().run()"
        :disabled="!editor.can().undo()"
        class="toolbar-btn"
        title="Undo"
      >
        <Icon name="ph:arrow-counter-clockwise" />
      </button>
      <button
        type="button"
        @click="editor.chain().focus().redo().run()"
        :disabled="!editor.can().redo()"
        class="toolbar-btn"
        title="Redo"
      >
        <Icon name="ph:arrow-clockwise" />
      </button>
    </div>

    <!-- Editor -->
    <EditorContent
      :editor="editor"
      class="wysiwyg-content bg-bg-tertiary border border-border rounded-b px-3 py-2 min-h-[120px] focus-within:border-white/20 transition-colors"
    />

    <!-- Character Count -->
    <div v-if="maxLength && editor" class="text-right mt-1">
      <span
        :class="[
          'text-[10px] font-mono',
          characterCount > maxLength ? 'text-error' : 'text-text-muted',
        ]"
      >
        {{ characterCount }} / {{ maxLength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  maxLength?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: props.placeholder || 'Start typing...',
    }),
    TextStyle,
    Color,
  ],
  editorProps: {
    attributes: {
      class:
        'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[100px]',
    },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML());
  },
});

const characterCount = computed(() => {
  return (
    editor.value?.storage.characterCount?.characters() ??
    editor.value?.getText().length ??
    0
  );
});

function setColor(event: Event) {
  const color = (event.target as HTMLInputElement).value;
  editor.value?.chain().focus().setColor(color).run();
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor.value && editor.value.getHTML() !== newValue) {
      editor.value.commands.setContent(newValue);
    }
  }
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
.toolbar-btn {
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toolbar-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}
</style>

<style>
.wysiwyg-content .ProseMirror {
  min-height: 100px;
  font-size: 0.875rem;
  color: var(--text-primary);
  outline: none;
}

.wysiwyg-content .ProseMirror p.is-editor-empty:first-child::before {
  color: var(--text-muted);
  pointer-events: none;
  float: left;
  height: 0;
  content: attr(data-placeholder);
}

.wysiwyg-content .ProseMirror h1 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.wysiwyg-content .ProseMirror h2 {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.wysiwyg-content .ProseMirror h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.wysiwyg-content .ProseMirror ul,
.wysiwyg-content .ProseMirror ol {
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
}

.wysiwyg-content .ProseMirror ul {
  list-style-type: disc;
}

.wysiwyg-content .ProseMirror ol {
  list-style-type: decimal;
}

.wysiwyg-content .ProseMirror blockquote {
  border-left: 2px solid var(--border);
  padding-left: 0.75rem;
  font-style: italic;
  color: var(--text-muted);
  margin: 0.5rem 0;
}

.wysiwyg-content .ProseMirror pre {
  background: var(--bg-primary);
  border-radius: 0.25rem;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.wysiwyg-content .ProseMirror code {
  background: var(--bg-primary);
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.75rem;
}

.wysiwyg-content .ProseMirror hr {
  border-color: var(--border);
  margin: 1rem 0;
}

.wysiwyg-content .ProseMirror p {
  margin-bottom: 0.5rem;
}

.wysiwyg-content .ProseMirror strong {
  font-weight: 700;
}

.wysiwyg-content .ProseMirror em {
  font-style: italic;
}

.wysiwyg-content .ProseMirror s {
  text-decoration: line-through;
}
</style>
