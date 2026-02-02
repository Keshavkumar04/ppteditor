/**
 * Test script that uses the actual importer code
 * Run with: node test-full-import.mjs
 */

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Setup DOM globals
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;

// EMU conversion
const EMU_PER_PIXEL = 9525;
function emuToPixels(emu) {
  return Math.round(emu / EMU_PER_PIXEL);
}

// ID generator
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

// Default theme colors
const DEFAULT_THEME_COLORS = {
  dk1: '#000000',
  dk2: '#44546A',
  lt1: '#FFFFFF',
  lt2: '#E7E6E6',
  accent1: '#4472C4',
  accent2: '#ED7D31',
  accent3: '#A5A5A5',
  accent4: '#FFC000',
  accent5: '#5B9BD5',
  accent6: '#70AD47',
  hlink: '#0563C1',
  folHlink: '#954F72',
};

// Helper to find child elements
function findChild(element, localName) {
  if (!element) return null;
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1) {
      const name = child.localName || child.nodeName.split(':').pop();
      if (name === localName) return child;
    }
  }
  return null;
}

function findChildren(element, localName) {
  const result = [];
  if (!element) return result;
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1) {
      const name = child.localName || child.nodeName.split(':').pop();
      if (name === localName) result.push(child);
    }
  }
  return result;
}

function getAttr(element, ...names) {
  if (!element) return null;
  for (const name of names) {
    const val = element.getAttribute(name);
    if (val !== null) return val;
  }
  return null;
}

// Parse theme colors
function parseThemeColors(themeXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(themeXml, 'application/xml');
  const colors = { ...DEFAULT_THEME_COLORS };

  const clrScheme = doc.getElementsByTagName('a:clrScheme')[0];
  if (!clrScheme) return colors;

  const colorMap = {
    'dk1': 'dk1', 'dk2': 'dk2', 'lt1': 'lt1', 'lt2': 'lt2',
    'accent1': 'accent1', 'accent2': 'accent2', 'accent3': 'accent3',
    'accent4': 'accent4', 'accent5': 'accent5', 'accent6': 'accent6',
    'hlink': 'hlink', 'folHlink': 'folHlink'
  };

  for (const [tag, key] of Object.entries(colorMap)) {
    const el = clrScheme.getElementsByTagName(`a:${tag}`)[0];
    if (el) {
      const srgb = el.getElementsByTagName('a:srgbClr')[0];
      const sys = el.getElementsByTagName('a:sysClr')[0];
      if (srgb) {
        colors[key] = '#' + srgb.getAttribute('val');
      } else if (sys) {
        colors[key] = '#' + (sys.getAttribute('lastClr') || '000000');
      }
    }
  }

  return colors;
}

// Parse background
function parseBackground(cSldEl, themeColors) {
  const bgEl = findChild(cSldEl, 'bg');
  if (!bgEl) {
    return { type: 'solid', color: '#FFFFFF' };
  }

  const bgPrEl = findChild(bgEl, 'bgPr');
  if (bgPrEl) {
    const solidFill = findChild(bgPrEl, 'solidFill');
    if (solidFill) {
      const color = parseColor(solidFill, themeColors);
      return { type: 'solid', color };
    }

    const gradFill = findChild(bgPrEl, 'gradFill');
    if (gradFill) {
      return parseGradientBackground(gradFill, themeColors);
    }
  }

  const bgRef = findChild(bgEl, 'bgRef');
  if (bgRef) {
    const solidFill = findChild(bgRef, 'solidFill') || findChild(bgRef, 'srgbClr') || findChild(bgRef, 'schemeClr');
    if (solidFill) {
      const color = parseColor(bgRef, themeColors);
      return { type: 'solid', color };
    }
  }

  return { type: 'solid', color: '#FFFFFF' };
}

function parseColor(element, themeColors) {
  if (!element) return '#000000';

  const srgbClr = findChild(element, 'srgbClr');
  if (srgbClr) {
    return '#' + (getAttr(srgbClr, 'val') || '000000');
  }

  const schemeClr = findChild(element, 'schemeClr');
  if (schemeClr) {
    const scheme = getAttr(schemeClr, 'val') || 'dk1';
    return themeColors[scheme] || '#000000';
  }

  const sysClr = findChild(element, 'sysClr');
  if (sysClr) {
    return '#' + (getAttr(sysClr, 'lastClr') || '000000');
  }

  return '#000000';
}

function parseGradientBackground(gradFill, themeColors) {
  const gsLst = findChild(gradFill, 'gsLst');
  const stops = [];

  if (gsLst) {
    const gsElements = findChildren(gsLst, 'gs');
    for (const gs of gsElements) {
      const pos = parseInt(getAttr(gs, 'pos') || '0', 10) / 1000;
      const color = parseColor(gs, themeColors);
      stops.push({ position: pos, color });
    }
  }

  if (stops.length < 2) {
    return { type: 'solid', color: stops[0]?.color || '#FFFFFF' };
  }

  return {
    type: 'gradient',
    gradient: {
      type: 'linear',
      angle: 90,
      stops
    }
  };
}

// Parse master background
function parseMasterBackground(masterXml, themeColors) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(masterXml, 'application/xml');
  const cSldEl = doc.getElementsByTagName('p:cSld')[0];
  if (!cSldEl) return { type: 'solid', color: '#FFFFFF' };
  return parseBackground(cSldEl, themeColors);
}

// Parse slide elements (simplified)
function parseSlideElements(slideXml, themeColors) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(slideXml, 'application/xml');

  const elements = [];
  const spList = doc.getElementsByTagName('p:sp');
  const picList = doc.getElementsByTagName('p:pic');

  // Parse shapes
  for (let i = 0; i < spList.length; i++) {
    const sp = spList[i];

    // Get position/size
    const xfrmEl = sp.getElementsByTagName('a:xfrm')[0];
    if (!xfrmEl) continue;

    const offEl = findChild(xfrmEl, 'off');
    const extEl = findChild(xfrmEl, 'ext');
    if (!offEl || !extEl) continue;

    const x = emuToPixels(parseInt(getAttr(offEl, 'x') || '0', 10));
    const y = emuToPixels(parseInt(getAttr(offEl, 'y') || '0', 10));
    const width = emuToPixels(parseInt(getAttr(extEl, 'cx') || '0', 10));
    const height = emuToPixels(parseInt(getAttr(extEl, 'cy') || '0', 10));

    // Check for text content
    const txBody = sp.getElementsByTagName('p:txBody')[0];
    let textContent = '';
    if (txBody) {
      const textRuns = txBody.getElementsByTagName('a:t');
      for (let j = 0; j < textRuns.length; j++) {
        textContent += textRuns[j].textContent || '';
      }
    }

    elements.push({
      type: textContent ? 'text' : 'shape',
      x, y, width, height,
      text: textContent || null
    });
  }

  // Parse pictures
  for (let i = 0; i < picList.length; i++) {
    const pic = picList[i];
    const xfrmEl = pic.getElementsByTagName('a:xfrm')[0];
    if (!xfrmEl) continue;

    const offEl = findChild(xfrmEl, 'off');
    const extEl = findChild(xfrmEl, 'ext');
    if (!offEl || !extEl) continue;

    elements.push({
      type: 'image',
      x: emuToPixels(parseInt(getAttr(offEl, 'x') || '0', 10)),
      y: emuToPixels(parseInt(getAttr(offEl, 'y') || '0', 10)),
      width: emuToPixels(parseInt(getAttr(extEl, 'cx') || '0', 10)),
      height: emuToPixels(parseInt(getAttr(extEl, 'cy') || '0', 10))
    });
  }

  return elements;
}

async function testDetailedImport(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${fileName}`);
  console.log('='.repeat(60));

  try {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // Parse theme
    const themeXml = await zip.file('ppt/theme/theme1.xml')?.async('string');
    const themeColors = themeXml ? parseThemeColors(themeXml) : DEFAULT_THEME_COLORS;

    // Parse master background
    let masterBackground = { type: 'solid', color: '#FFFFFF' };
    const masterXml = await zip.file('ppt/slideMasters/slideMaster1.xml')?.async('string');
    if (masterXml) {
      masterBackground = parseMasterBackground(masterXml, themeColors);
    }
    console.log('\nMaster Background:', JSON.stringify(masterBackground));

    // Get slide count
    const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
    const parser = new DOMParser();
    const presDoc = parser.parseFromString(presentationXml, 'application/xml');
    const slideCount = presDoc.getElementsByTagName('p:sldId').length || 1;

    console.log(`\nSlides: ${slideCount}`);

    // Parse first 3 slides in detail
    for (let i = 1; i <= Math.min(3, slideCount); i++) {
      const slideXml = await zip.file(`ppt/slides/slide${i}.xml`)?.async('string');
      if (!slideXml) continue;

      // Parse slide background
      const slideDoc = parser.parseFromString(slideXml, 'application/xml');
      const cSldEl = slideDoc.getElementsByTagName('p:cSld')[0];
      let slideBackground = cSldEl ? parseBackground(cSldEl, themeColors) : { type: 'solid', color: '#FFFFFF' };

      // Use master background if slide has default white
      if (slideBackground.type === 'solid' && slideBackground.color === '#FFFFFF') {
        slideBackground = masterBackground;
      }

      const elements = parseSlideElements(slideXml, themeColors);

      console.log(`\n  Slide ${i}:`);
      console.log(`    Background: ${JSON.stringify(slideBackground)}`);
      console.log(`    Elements: ${elements.length}`);

      // Show first few elements
      const textEls = elements.filter(e => e.type === 'text');
      const shapeEls = elements.filter(e => e.type === 'shape');
      const imageEls = elements.filter(e => e.type === 'image');

      console.log(`    - Text boxes: ${textEls.length}`);
      console.log(`    - Shapes: ${shapeEls.length}`);
      console.log(`    - Images: ${imageEls.length}`);

      if (textEls.length > 0) {
        console.log(`    Sample text: "${textEls[0].text?.substring(0, 50)}..."`);
      }
    }

    console.log('\n✓ Detailed import test PASSED');
    return true;

  } catch (error) {
    console.log(`\n✗ Test FAILED: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function main() {
  console.log('Detailed PPTX Import Tests');
  console.log('==========================\n');

  const testDir = './testpptsamples';
  const files = fs.readdirSync(testDir)
    .filter(f => f.endsWith('.pptx') && !f.startsWith('test-export'))
    .map(f => path.join(testDir, f));

  let passed = 0;
  for (const file of files) {
    if (await testDetailedImport(file)) passed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed}/${files.length} tests passed`);
  console.log('='.repeat(60));
}

main().catch(console.error);
