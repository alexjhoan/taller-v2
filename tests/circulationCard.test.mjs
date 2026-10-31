// Tests del parser posicional del certificado de circulación (spec OCR checkin).
// Usa las líneas REALES capturadas por el usuario con tesseract.js en una foto
// de un certificado INTT (Chery Orinoco 2013, placa AK244GA).
// Comentarios en español; nombres técnicos en inglés.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCirculationCard } from '../src/utils/circulationCardOcr.ts';

// Líneas crudas tal cual las reportó la consola del usuario (con ruido: §, |, —, comillas)
const REAL_CAPTURE = [
  { text: 'DE” CERTIFICADO DE TT o', y: 0, x: 92 },
  { text: 'L TRA', y: 34, x: 76 },
  { text: '4 | :', y: 107, x: 36 },
  { text: 'jf 200106315862 Placa AK244GA |', y: 121, x: 90 },
  { text: '§ ALEX JHOAN RAMIREZ LINARES', y: 217, x: 96 },
  { text: 'V18707791 CHERY :', y: 259, x: 103 },
  { text: '§ ORINOCO 0132013 $', y: 296, x: 109 },
  { text: 'AUTOMOVIL PARTICULAR aci', y: 361, x: 157 },
  { text: '— SEDAN ei', y: 385, x: 70 },
  { text: '— E SariaiNiV: exXTTIC12300006309 E 4', y: 420, x: 72 },
  { text: 'SPTOS. Jr', y: 541, x: 177 },
  { text: 'RINT a A" |', y: 616, x: 103 },
  { text: 'E í vet ra. ic al', y: 634, x: 107 },
];

describe('parseCirculationCard (captura real del usuario)', () => {
  const result = parseCirculationCard(REAL_CAPTURE);

  test('placa leída de la etiqueta "Placa:" → AK244GA', () => {
    assert.equal(result.data.plate, 'AK244GA');
  });

  test('cédula ancla V+dígitos → V18707791', () => {
    assert.equal(result.data.ownerId, 'V18707791');
  });

  test('nombre = fila solo-letras sobre la cédula', () => {
    assert.equal(result.data.ownerName, 'Alex Jhoan Ramirez Linares');
  });

  test('marca conocida en la fila de la cédula → Chery', () => {
    assert.equal(result.data.make, 'Chery');
  });

  test('modelo = fila siguiente a la cédula → Orinoco', () => {
    assert.equal(result.data.model, 'Orinoco');
  });

  test('año: el OCR leyó "0132013" (de 2013/2013) → últimos 4 dígitos = 2013', () => {
    assert.equal(result.data.year, '2013');
  });

  test('color: la fila KGS/EJES no fue leída por el OCR → queda en missing', () => {
    assert.equal(result.data.color, undefined);
    assert.ok(result.missing.includes('color'));
  });

  test('resumen: 6 campos detectados, 1 faltante', () => {
    assert.equal(result.found.length, 6);
    assert.deepEqual(result.missing, ['color']);
  });
});

describe('parseCirculationCard (nueva captura real del usuario - con prefijos Y/IB/4)', () => {
  // Captura EXACTA del último intento del usuario (con ruido OCR: Y, IB, 4, puntos, guiones)
  const newCapture = [
    { text: 'VR CERTIFICADO DE CIRCULACIÓN', y: 0, x: 131 },
    { text: 'MY E', y: 64, x: 0 },
    { text: '4 200106315867 PLACA AK244GA -', y: 119, x: 35 },
    { text: 'IB ALEX JHOAN RAMIREZ LINARES', y: 161, x: 63 },
    { text: 'Y V18707791 CHERY EA', y: 256, x: 68 },
    { text: '. ORINOCO 20112013', y: 297, x: 72 },
    { text: 'MY AUTOMOVIL PARTICULAR E', y: 340, x: 75 },
    { text: 'SEDAN AC Y', y: 397, x: 203 },
    { text: 'SERIA NV X7T1C123DD0008309 PE Z', y: 429, x: 191 },
    { text: '17SXES 28088 AZUL', y: 488, x: 197 },
    { text: 'SY Y Y', y: 574, x: 149 },
    { text: 'INT 1. M0 MO E -', y: 591, x: 158 },
    { text: 'EO EC DE I OL A 4 TA', y: 650, x: 200 },
    { text: 'CA LE LI E', y: 679, x: 156 },
  ];

  const result = parseCirculationCard(newCapture);

  test('placa AK244GA desde "PLACA AK244GA" (prefijo "4 serial")', () => {
    assert.equal(result.data.plate, 'AK244GA');
  });

  test('cédula V18707791 (prefijo "Y ")', () => {
    assert.equal(result.data.ownerId, 'V18707791');
  });

  test('nombre "Alex Jhoan Ramirez Linares" (prefijo "IB ")', () => {
    assert.equal(result.data.ownerName, 'Alex Jhoan Ramirez Linares');
  });

  test('marca Chery (misma fila que la cédula)', () => {
    assert.equal(result.data.make, 'Chery');
  });

  test('modelo Orinoco (fila siguiente) + año 2013 (últimos 4 de "20112013")', () => {
    assert.equal(result.data.model, 'Orinoco');
    assert.equal(result.data.year, '2013');
  });

  test('color Azul desde fila "17SXES 28088 AZUL" (fallback por lista)', () => {
    assert.equal(result.data.color, 'Azul');
  });

  test('resumen: 7 detectados, 0 faltantes', () => {
    assert.equal(result.found.length, 7);
    assert.deepEqual(result.missing, []);
  });
});

describe('parseCirculationCard (certificado de muestra con fila de specs completa)', () => {
  // Caso del certificado de muestra: "400 KGS 2 EJES PLATA" sí fue leído
  const sampleCapture = [
    { text: '220107551958 Placa: AF019CS', y: 121, x: 90 },
    { text: 'MARIO MARRUGO GONZALEZ', y: 217, x: 96 },
    { text: 'V08500870 MITSUBISHI', y: 259, x: 103 },
    { text: 'SIGNO GLI 1.3L 2006', y: 296, x: 109 },
    { text: 'AUTOMOVIL PARTICULAR', y: 361, x: 157 },
    { text: 'SEDAN', y: 385, x: 70 },
    { text: 'SERIAL N.I.V.: 8X1CK1ASN6Y801385', y: 420, x: 72 },
    { text: '400 KGS 2 EJES PLATA', y: 470, x: 103 },
    { text: '5 PTOS.', y: 541, x: 177 },
  ];

  const result = parseCirculationCard(sampleCapture);

  test('placa AF019CS', () => {
    assert.equal(result.data.plate, 'AF019CS');
  });

  test('nombre Mario Marrugo Gonzalez', () => {
    assert.equal(result.data.ownerName, 'Mario Marrugo Gonzalez');
  });

  test('cédula V08500870', () => {
    assert.equal(result.data.ownerId, 'V08500870');
  });

  test('marca Mitsubishi (el modelo 1.3L NO se confunde con el año)', () => {
    assert.equal(result.data.make, 'Mitsubishi');
  });

  test('modelo "Signo Gli 1.3L" conserva su cilindrada', () => {
    assert.equal(result.data.model, 'Signo Gli 1.3L');
  });

  test('año 2006 tomado de la fila del modelo', () => {
    assert.equal(result.data.year, '2006');
  });

  test('color Plata desde la fila KGS/EJES', () => {
    assert.equal(result.data.color, 'Plata');
  });

  test('todos los campos detectados', () => {
    assert.deepEqual(result.missing, []);
  });
});
