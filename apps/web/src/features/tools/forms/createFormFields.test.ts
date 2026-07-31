import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import {
  assertValidFormFieldName,
  createFormFields,
} from './createFormFields';
import { uint8ToArrayBuffer } from '@/features/files/localDownload';

describe('createFormFields', () => {
  it('rejects invalid field names', () => {
    expect(() => assertValidFormFieldName('1bad')).toThrow();
    expect(() => assertValidFormFieldName('ok_name')).not.toThrow();
  });

  it('creates fields, sets tooltip TU, and Tabs /A', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    const bytes = await doc.save();
    const out = await createFormFields({
      bytes: uint8ToArrayBuffer(bytes),
      fields: [
        {
          type: 'text',
          name: 'field1',
          page: 1,
          x: 40,
          y: 500,
          w: 120,
          h: 24,
          tooltip: 'Hello tip',
        },
        {
          type: 'dropdown',
          name: 'field2',
          page: 1,
          x: 40,
          y: 450,
          w: 120,
          h: 24,
          options: ['A', 'B'],
        },
      ],
    });
    const loaded = await PDFDocument.load(out);
    const page = loaded.getPage(0);
    const tabs = page.node.get(PDFName.of('Tabs'));
    expect(tabs && String(tabs)).toBe('/A');
    const form = loaded.getForm();
    expect(form.getTextField('field1')).toBeTruthy();
    expect(form.getDropdown('field2')).toBeTruthy();
  });

  it('rejects empty dropdown options', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const bytes = await doc.save();
    await expect(
      createFormFields({
        bytes: uint8ToArrayBuffer(bytes),
        fields: [
          {
            type: 'dropdown',
            name: 'dd',
            page: 1,
            x: 10,
            y: 10,
            w: 50,
            h: 20,
            options: [],
          },
        ],
      })
    ).rejects.toThrow(/option/i);
  });
});
