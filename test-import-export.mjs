/**
 * Test script for PPTX import/export
 * Run with: node test-import-export.mjs
 */

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup DOM globals for our parsers
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;

// Simple ID generator
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

// EMU conversion
const EMU_PER_PIXEL = 9525;
function emuToPixels(emu) {
  return Math.round(emu / EMU_PER_PIXEL);
}

// Parse presentation.xml to get slide count
function parsePresentationXml(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');
  const sldIdElements = doc.getElementsByTagName('p:sldId');
  return sldIdElements.length;
}

// Parse slide to count elements
function parseSlideXml(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const shapes = doc.getElementsByTagName('p:sp').length;
  const pictures = doc.getElementsByTagName('p:pic').length;
  const groups = doc.getElementsByTagName('p:grpSp').length;

  return { shapes, pictures, groups, total: shapes + pictures };
}

// Parse theme colors
function parseThemeXml(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const clrScheme = doc.getElementsByTagName('a:clrScheme')[0];
  const colors = {};

  if (clrScheme) {
    const colorTags = ['a:dk1', 'a:dk2', 'a:lt1', 'a:lt2', 'a:accent1', 'a:accent2'];
    for (const tag of colorTags) {
      const el = clrScheme.getElementsByTagName(tag)[0];
      if (el) {
        const srgb = el.getElementsByTagName('a:srgbClr')[0];
        const sys = el.getElementsByTagName('a:sysClr')[0];
        if (srgb) {
          colors[tag.replace('a:', '')] = '#' + srgb.getAttribute('val');
        } else if (sys) {
          colors[tag.replace('a:', '')] = '#' + (sys.getAttribute('lastClr') || '000000');
        }
      }
    }
  }

  return colors;
}

async function testImport(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${fileName}`);
  console.log('='.repeat(60));

  try {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // Parse presentation.xml
    const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
    if (!presentationXml) {
      throw new Error('Missing presentation.xml');
    }

    const slideCount = parsePresentationXml(presentationXml);
    console.log(`\nSlide count: ${slideCount}`);

    // Parse theme
    const themeXml = await zip.file('ppt/theme/theme1.xml')?.async('string');
    if (themeXml) {
      const colors = parseThemeXml(themeXml);
      console.log('\nTheme colors:');
      for (const [key, value] of Object.entries(colors)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Parse each slide
    console.log('\nSlide details:');
    let totalElements = 0;

    for (let i = 1; i <= slideCount; i++) {
      const slideXml = await zip.file(`ppt/slides/slide${i}.xml`)?.async('string');
      if (slideXml) {
        const elements = parseSlideXml(slideXml);
        console.log(`  Slide ${i}: ${elements.shapes} shapes, ${elements.pictures} images`);
        totalElements += elements.total;
      }
    }

    console.log(`\nTotal elements: ${totalElements}`);

    // Check media files
    const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
    console.log(`Media files: ${mediaFiles.length}`);
    if (mediaFiles.length > 0) {
      const extensions = {};
      for (const f of mediaFiles) {
        const ext = path.extname(f).toLowerCase();
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
      console.log('  Types:', Object.entries(extensions).map(([k,v]) => `${k}(${v})`).join(', '));
    }

    console.log('\n✓ Import test PASSED');
    return { success: true, slideCount, totalElements };

  } catch (error) {
    console.log(`\n✗ Import test FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testExport() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing Export (pptxgenjs)');
  console.log('='.repeat(60));

  try {
    // Dynamically import pptxgenjs
    const PptxGenJS = (await import('pptxgenjs')).default;

    // Create a test presentation
    const pptx = new PptxGenJS();
    pptx.author = 'Test Author';
    pptx.title = 'Test Export';

    // Add a slide with text
    const slide1 = pptx.addSlide();
    slide1.background = { color: 'FFFFFF' };
    slide1.addText('Hello World', {
      x: 1,
      y: 1,
      w: 8,
      h: 1,
      fontSize: 36,
      bold: true,
      color: '4472C4',
    });

    // Add a slide with a shape
    const slide2 = pptx.addSlide();
    slide2.addShape('rect', {
      x: 1,
      y: 1,
      w: 3,
      h: 2,
      fill: { color: 'ED7D31' },
      line: { color: '2F528F', width: 2 },
    });
    slide2.addText('Shape Test', {
      x: 1,
      y: 3.5,
      w: 3,
      h: 0.5,
      fontSize: 18,
      align: 'center',
    });

    // Generate the file
    const outputPath = './testpptsamples/test-export-output.pptx';
    await pptx.writeFile({ fileName: outputPath });

    // Verify the output file
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`\nOutput file: ${outputPath}`);
      console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);

      // Verify it's a valid PPTX
      const data = fs.readFileSync(outputPath);
      const zip = await JSZip.loadAsync(data);
      const hasPresentation = zip.file('ppt/presentation.xml') !== null;
      const slides = Object.keys(zip.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/));

      console.log(`Valid PPTX: ${hasPresentation}`);
      console.log(`Slides created: ${slides.length}`);

      console.log('\n✓ Export test PASSED');
      return { success: true };
    } else {
      throw new Error('Output file not created');
    }

  } catch (error) {
    console.log(`\n✗ Export test FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('PPTX Import/Export Tests');
  console.log('========================\n');

  const testDir = './testpptsamples';
  const files = fs.readdirSync(testDir)
    .filter(f => f.endsWith('.pptx') && !f.startsWith('test-export'))
    .map(f => path.join(testDir, f));

  const results = {
    import: { passed: 0, failed: 0 },
    export: { passed: 0, failed: 0 },
  };

  // Test imports
  for (const file of files) {
    const result = await testImport(file);
    if (result.success) {
      results.import.passed++;
    } else {
      results.import.failed++;
    }
  }

  // Test export
  const exportResult = await testExport();
  if (exportResult.success) {
    results.export.passed++;
  } else {
    results.export.failed++;
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Import tests: ${results.import.passed} passed, ${results.import.failed} failed`);
  console.log(`Export tests: ${results.export.passed} passed, ${results.export.failed} failed`);

  const allPassed = results.import.failed === 0 && results.export.failed === 0;
  console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
}

runTests().catch(console.error);
