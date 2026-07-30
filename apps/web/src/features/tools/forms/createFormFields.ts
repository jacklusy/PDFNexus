/**
 * Create AcroForm fields on a PDF via pdf-lib.
 */

import { loadReadablePdf } from '../assertPdfReadable';

export type FormFieldType =
  | 'text'
  | 'date'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'button'
  | 'signature';

export interface FormFieldSpec {
  type: FormFieldType;
  name: string;
  page: number; // 1-based
  x: number;
  y: number;
  w: number;
  h: number;
  required?: boolean;
  /** Button label / radio option value / dropdown options (comma-separated in UI). */
  options?: string[];
  label?: string;
  /** Default text / date string. */
  defaultValue?: string;
  tooltip?: string;
}

export interface CreateFormFieldsOptions {
  bytes: ArrayBuffer;
  fields: FormFieldSpec[];
}

export async function createFormFields(
  options: CreateFormFieldsOptions
): Promise<Uint8Array> {
  const doc = await loadReadablePdf(options.bytes);
  const form = doc.getForm();
  const pageCount = doc.getPageCount();

  if (!options.fields.length) {
    throw new Error('Add at least one form field.');
  }

  const usedNames = new Set<string>();

  for (const spec of options.fields) {
    const name = spec.name.trim();
    if (!name) throw new Error('Every field needs a name.');
    if (usedNames.has(name)) {
      throw new Error(`Duplicate field name “${name}”.`);
    }
    usedNames.add(name);

    if (spec.page < 1 || spec.page > pageCount) {
      throw new Error(`Page ${spec.page} is outside 1–${pageCount}.`);
    }
    if (!(spec.w > 0) || !(spec.h > 0)) {
      throw new Error(`Field “${name}” needs positive width and height.`);
    }

    const page = doc.getPage(spec.page - 1);
    const box = {
      x: spec.x,
      y: spec.y,
      width: spec.w,
      height: spec.h,
    };

    switch (spec.type) {
      case 'text':
      case 'date': {
        const field = form.createTextField(name);
        if (spec.required) field.enableRequired();
        if (spec.type === 'date') {
          field.setMaxLength(10);
          if (spec.defaultValue) field.setText(spec.defaultValue);
          else field.setText('');
        } else if (spec.defaultValue) {
          field.setText(spec.defaultValue);
        }
        field.addToPage(page, box);
        break;
      }
      case 'signature': {
        // pdf-lib has no createSignature(); empty multiline text widget acts as
        // a signature placeholder users can fill/sign in Acrobat or similar.
        const field = form.createTextField(name);
        if (spec.required) field.enableRequired();
        field.enableMultiline();
        field.setText(spec.defaultValue || '');
        field.addToPage(page, box);
        break;
      }
      case 'checkbox': {
        const field = form.createCheckBox(name);
        if (spec.required) field.enableRequired();
        field.addToPage(page, box);
        break;
      }
      case 'radio': {
        const field = form.createRadioGroup(name);
        if (spec.required) field.enableRequired();
        const opts =
          spec.options && spec.options.length ? spec.options : ['Yes', 'No'];
        opts.forEach((opt, i) => {
          field.addOptionToPage(opt, page, {
            ...box,
            y: box.y - i * (box.height + 4),
          });
        });
        break;
      }
      case 'dropdown': {
        const field = form.createDropdown(name);
        if (spec.required) field.enableRequired();
        const opts =
          spec.options && spec.options.length
            ? spec.options
            : ['Option 1', 'Option 2'];
        field.addOptions(opts);
        field.addToPage(page, box);
        break;
      }
      case 'button': {
        const field = form.createButton(name);
        if (spec.required) field.enableRequired();
        field.addToPage(spec.label || name, page, box);
        break;
      }
      default: {
        const _exhaustive: never = spec.type;
        throw new Error(`Unsupported field type: ${_exhaustive}`);
      }
    }
  }

  form.updateFieldAppearances();
  return doc.save();
}
