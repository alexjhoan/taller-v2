// Tests de src/utils/parts.ts — helpers del flujo de aprobación de repuestos (spec 008).
// Node importa .ts directo con type stripping (mismo estilo que ids.test.mjs).
// Comentarios en español; nombres técnicos en inglés.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPartVisibleInPortal,
  canTechnicianDeletePart,
  getPartActions,
  partNeedsPrice,
  countOrdersWithPendingParts,
  serializeParts,
  assignFallbackPartIds,
} from '../src/utils/parts.ts';
import { generateShortUid } from '../src/utils/uid.ts';

describe('isPartVisibleInPortal (RF-7/RF-6)', () => {
  test('approvalStatus "accepted" → visible en el portal', () => {
    assert.equal(isPartVisibleInPortal({ approvalStatus: 'accepted' }), true);
  });

  test('approvalStatus ausente (legacy/checkin) → visible en el portal', () => {
    assert.equal(isPartVisibleInPortal({}), true);
    assert.equal(isPartVisibleInPortal({ approvalStatus: undefined }), true);
  });

  test('approvalStatus "pending" → NO visible en el portal', () => {
    assert.equal(isPartVisibleInPortal({ approvalStatus: 'pending' }), false);
  });

  test('approvalStatus "rejected" → NO visible en el portal', () => {
    assert.equal(isPartVisibleInPortal({ approvalStatus: 'rejected' }), false);
  });
});

describe('canTechnicianDeletePart (RF-13/D2)', () => {
  test('solicitud propia (requestedByTechnician: true) en "pending" → puede borrar', () => {
    assert.equal(
      canTechnicianDeletePart({ requestedByTechnician: true, approvalStatus: 'pending' }),
      true,
    );
  });

  test('solicitud propia sin approvalStatus → puede borrar (no está aceptada)', () => {
    assert.equal(canTechnicianDeletePart({ requestedByTechnician: true }), true);
  });

  test('solicitud propia en "rejected" → puede borrar (sigue sin estar aceptada)', () => {
    assert.equal(
      canTechnicianDeletePart({ requestedByTechnician: true, approvalStatus: 'rejected' }),
      true,
    );
  });

  test('solicitud propia en "accepted" → NO puede borrar (nunca borra lo aceptado)', () => {
    assert.equal(
      canTechnicianDeletePart({ requestedByTechnician: true, approvalStatus: 'accepted' }),
      false,
    );
  });

  test('repuesto del admin/checkin (requestedByTechnician: false) → NO puede borrar en ningún estado', () => {
    assert.equal(
      canTechnicianDeletePart({ requestedByTechnician: false, approvalStatus: 'pending' }),
      false,
    );
    assert.equal(
      canTechnicianDeletePart({ requestedByTechnician: false, approvalStatus: 'rejected' }),
      false,
    );
    assert.equal(
      canTechnicianDeletePart({ requestedByTechnician: false, approvalStatus: 'accepted' }),
      false,
    );
    // Sin approvalStatus (checkin/legacy) tampoco: no es su solicitud.
    assert.equal(canTechnicianDeletePart({ requestedByTechnician: false }), false);
    // Sin requestedByTechnician explícito → no es su solicitud.
    assert.equal(canTechnicianDeletePart({ approvalStatus: 'pending' }), false);
  });
});

describe('getPartActions (RF-2/RF-4)', () => {
  test('"pending" → puede Aprobar y puede Rechazar', () => {
    assert.deepEqual(getPartActions('pending'), { canApprove: true, canReject: true });
  });

  test('"accepted" → NO puede Aceptar, puede Rechazar (Rechazar = deshacer)', () => {
    assert.deepEqual(getPartActions('accepted'), { canApprove: false, canReject: true });
  });

  test('"rejected" → puede Aprobar, NO puede Rechazar (Aprobar = deshacer)', () => {
    assert.deepEqual(getPartActions('rejected'), { canApprove: true, canReject: false });
  });

  test('sin approvalStatus (legacy/checkin) → ninguno de los dos botones', () => {
    assert.deepEqual(getPartActions(undefined), { canApprove: false, canReject: false });
  });
});

describe('partNeedsPrice (RF-3)', () => {
  test('unit_price ausente → necesita precio', () => {
    assert.equal(partNeedsPrice({}), true);
    assert.equal(partNeedsPrice({ unit_price: undefined }), true);
  });

  test('unit_price 0 → necesita precio', () => {
    assert.equal(partNeedsPrice({ unit_price: 0 }), true);
  });

  test('unit_price null → necesita precio', () => {
    assert.equal(partNeedsPrice({ unit_price: null }), true);
  });

  test('unit_price con valor real → NO necesita precio', () => {
    assert.equal(partNeedsPrice({ unit_price: 180000 }), false);
    assert.equal(partNeedsPrice({ unit_price: 0.5 }), false);
  });
});

describe('countOrdersWithPendingParts (RF-8)', () => {
  test('0 órdenes → 0', () => {
    assert.equal(countOrdersWithPendingParts([]), 0);
  });

  test('órdenes sin repuestos (sin parts, null o lista vacía) → 0', () => {
    assert.equal(countOrdersWithPendingParts([{}, { parts: null }, { parts: [] }, { parts: '[]' }]), 0);
  });

  test('una orden con repuesto "pending" → 1', () => {
    const orders = [{ parts: [{ name: 'Filtro', approvalStatus: 'pending' }] }];
    assert.equal(countOrdersWithPendingParts(orders), 1);
  });

  test('una orden solo con repuestos "accepted"/"rejected" → 0', () => {
    const orders = [
      {
        parts: [
          { name: 'Filtro', approvalStatus: 'accepted' },
          { name: 'Bujía', approvalStatus: 'rejected' },
        ],
      },
    ];
    assert.equal(countOrdersWithPendingParts(orders), 0);
  });

  test('parts como JSON string válido con "pending" → lo cuenta', () => {
    const parts = JSON.stringify([{ name: 'Filtro', approvalStatus: 'pending' }]);
    assert.equal(countOrdersWithPendingParts([{ parts }]), 1);
  });

  test('parts con JSON corrupto → 0 sin lanzar', () => {
    assert.doesNotThrow(() => countOrdersWithPendingParts([{ parts: '[{"name":' }]));
    assert.equal(countOrdersWithPendingParts([{ parts: '[{"name":' }]), 0);
    assert.equal(countOrdersWithPendingParts([{ parts: 'basura }{' }]), 0);
  });

  test('parts como array directo (no string) → lo cuenta', () => {
    const orders = [{ parts: [{ approvalStatus: 'pending' }] }];
    assert.equal(countOrdersWithPendingParts(orders), 1);
  });

  test('varias órdenes con pendientes → cada orden cuenta una sola vez aunque tenga varios "pending"', () => {
    const orders = [
      {
        parts: [
          { name: 'A', approvalStatus: 'pending' },
          { name: 'B', approvalStatus: 'pending' },
        ],
      },
      { parts: [{ name: 'C', approvalStatus: 'pending' }] },
      { parts: [{ name: 'D', approvalStatus: 'accepted' }] },
    ];
    assert.equal(countOrdersWithPendingParts(orders), 2);
  });
});

describe('serializeParts', () => {
  const items = [
    {
      id: 7,
      name: 'Pastillas de freno',
      quantity: 4,
      unit_price: 180000,
      approvalStatus: 'accepted',
      requestedByTechnician: false,
      criticality: 'high',
      notes: 'delanteras',
      reference: 'REF-123',
    },
  ];

  test('descarta reference del resultado', () => {
    const parsed = JSON.parse(serializeParts(items));
    assert.equal('reference' in parsed[0], false);
    assert.equal(serializeParts(items).includes('REF-123'), false);
  });

  test('conserva id, name, quantity, unit_price, approvalStatus, requestedByTechnician, criticality y notes', () => {
    const parsed = JSON.parse(serializeParts(items));
    assert.deepEqual(parsed[0], {
      id: 7,
      name: 'Pastillas de freno',
      quantity: 4,
      unit_price: 180000,
      approvalStatus: 'accepted',
      requestedByTechnician: false,
      criticality: 'high',
      notes: 'delanteras',
    });
  });

  test('devuelve un string JSON que al parsear da el array esperado', () => {
    const out = serializeParts(items);
    assert.equal(typeof out, 'string');
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Pastillas de freno');
  });
});

test('approvalStatus null (distinto de undefined): NO visible y sin botones — comportamiento intencional de T-1', () => {
  // T-1 siguió el pseudocódigo literal de la spec (=== undefined || === "accepted"),
  // por lo que null NO cae en el caso legacy (undefined) y tampoco en ningún caso de
  // botón. Este test deja explícito que es decision deliberada, no un olvido.
  assert.equal(isPartVisibleInPortal({ approvalStatus: null }), false);
  assert.deepEqual(getPartActions(null), { canApprove: false, canReject: false });
});

describe('assignFallbackPartIds (T-14: id de respaldo para las acciones por repuesto)', () => {
  // Generador determinista: los tests no dependen del azar de generateShortUid.
  const makeFakeId = () => {
    let counter = 0;
    return () => `FB${++counter}`;
  };

  test('repuesto sin id → recibe un id de respaldo', () => {
    const out = assignFallbackPartIds([{ name: 'Pastillas', quantity: 2 }], makeFakeId());
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'FB1');
    // El resto de campos quedan igual.
    assert.equal(out[0].name, 'Pastillas');
    assert.equal(out[0].quantity, 2);
  });

  test('repuesto con id existente → se conserva igual (sin regenerarlo)', () => {
    const original = { id: 'ABC123', name: 'Filtro', quantity: 1, unit_price: 5000 };
    const out = assignFallbackPartIds([original], makeFakeId());
    assert.deepEqual(out[0], original);
    assert.equal(out[0].id, 'ABC123');
  });

  test('array vacío → devuelve un array vacío', () => {
    assert.deepEqual(assignFallbackPartIds([], makeFakeId()), []);
  });

  test('id vacío ("") o undefined → también recibe respaldo, uno distinto por repuesto', () => {
    const out = assignFallbackPartIds(
      [{ id: '', name: 'A' }, { id: undefined, name: 'B' }],
      makeFakeId(),
    );
    assert.equal(out[0].id, 'FB1');
    assert.equal(out[1].id, 'FB2');
    // Cada repuesto queda identificado por el SUYO (si todos compartieran id,
    // delete/approve/edit por p.id afectarían a toda la lista).
    assert.notEqual(out[0].id, out[1].id);
  });

  test('id numérico legacy → se conserva (las comparaciones p.id === p.id siguen acertando)', () => {
    const out = assignFallbackPartIds([{ id: 7, name: 'A' }], makeFakeId());
    assert.equal(out[0].id, 7);
  });

  test('no muta el array de entrada: el original sigue intacto y es otro array', () => {
    const input = [{ name: 'A' }, { id: 'X', name: 'B' }];
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = assignFallbackPartIds(input, makeFakeId());
    assert.notEqual(out, input);
    assert.deepEqual(input, snapshot);
    assert.equal('id' in input[0], false);
    assert.equal(out[0].id, 'FB1');
  });

  test('usa generateShortUid como generador: texto no vacío y único por repuesto', () => {
    const out = assignFallbackPartIds([{ name: 'A' }, { name: 'B' }], generateShortUid);
    for (const item of out) {
      assert.equal(typeof item.id, 'string');
      assert.ok(item.id.length > 0);
    }
    assert.notEqual(out[0].id, out[1].id);
  });
});
