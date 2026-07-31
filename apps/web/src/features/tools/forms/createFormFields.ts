/**
 * Create AcroForm fields on a PDF via pdf-lib.
 */

import { loadReadablePdf } from '../assertPdfReadable';
import { PDFName, PDFString } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';

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

const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertValidFormFieldName(name: string): void {
  if (!FIELD_NAME_RE.test(name)) {
    throw new Error(
      `Field name “${name}” must start with a letter or underscore and use only letters, digits, and underscores.`
    );
  }
}

function applyTooltip(
  field: { acroField: { dict: { set: (k: PDFName, v: PDFString) => void } } },
  tooltip?: string
): void {
  const t = tooltip?.trim();
  if (!t) return;
  try {
    field.acroField.dict.set(PDFName.of('TU'), PDFString.of(t));
  } catch {
    // best-effort
  }
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
  const touchedPages = new Set<PDFPage>();

  for (const spec of options.fields) {
    const name = spec.name.trim();
    if (!name) throw new Error('Every field needs a name.');
    assertValidFormFieldName(name);
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
    if (
      (spec.type === 'radio' || spec.type === 'dropdown') &&
      (!spec.options || spec.options.length === 0)
    ) {
      throw new Error(`Field “${name}” needs at least one option.`);
    }

    const page = doc.getPage(spec.page - 1);
    touchedPages.add(page);
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
        applyTooltip(field, spec.tooltip);
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
        applyTooltip(field, spec.tooltip);
        break;
      }
      case 'checkbox': {
        const field = form.createCheckBox(name);
        if (spec.required) field.enableRequired();
        field.addToPage(page, box);
        applyTooltip(field, spec.tooltip);
        break;
      }
      case 'radio': {
        const field = form.createRadioGroup(name);
        if (spec.required) field.enableRequired();
        const opts = spec.options!;
        opts.forEach((opt, i) => {
          field.addOptionToPage(opt, page, {
            ...box,
            y: box.y - i * (box.height + 4),
          });
        });
        applyTooltip(field, spec.tooltip);
        break;
      }
      case 'dropdown': {
        const field = form.createDropdown(name);
        if (spec.required) field.enableRequired();
        field.addOptions(spec.options!);
        field.addToPage(page, box);
        applyTooltip(field, spec.tooltip);
        break;
      }
      case 'button': {
        const field = form.createButton(name);
        if (spec.required) field.enableRequired();
        field.addToPage(spec.label || name, page, box);
        applyTooltip(field, spec.tooltip);
        break;
      }
      default: {
        const _exhaustive: never = spec.type;
        throw new Error(`Unsupported field type: ${_exhaustive}`);
      }
    }
  }

  // List / creation order = widget tab order for viewers that honor /Tabs /A.
  for (const page of touchedPages) {
    page.node.set(PDFName.of('Tabs'), PDFName.of('A'));
  }

  form.updateFieldAppearances();
  return doc.save();
}
