// Lecturas del escáner en vivo: solo códigos con dígito de control válido, UPC-E pasado a UPC-A
// y confirmación en dos cuadros seguidos.
import { describe, expect, it } from 'vitest';
import { codigoDeLectura, confirmadorDeLecturas, eanValido, expandirUpcE } from './codigos';

describe('Lectura del escáner', () => {
  it('acepta EAN-13, UPC-A y EAN-8 válidos y rechaza un dígito de control equivocado', () => {
    expect(codigoDeLectura('7441001639258')).toBe('7441001639258');
    expect(codigoDeLectura(' 036000291452 ')).toBe('036000291452');   // UPC-A de ejemplo de GS1
    expect(codigoDeLectura('96385074')).toBe('96385074');             // EAN-8 de ejemplo de GS1
    expect(codigoDeLectura('7441001639259')).toBeUndefined();
    expect(codigoDeLectura('ABC123')).toBeUndefined();
    expect(codigoDeLectura('')).toBeUndefined();
  });
  it('UPC-E: se expande a UPC-A según el último dígito (los cuatro casos)', () => {
    expect(expandirUpcE('01234565')).toBe('012345000065');   // último 5-9: ejemplo publicado de GS1
    expect(expandirUpcE('01234505')).toBe('012000003455');   // último 0-2: XX + último + 0000 + XXX
    expect(expandirUpcE('01234535')).toBe('012300000455');   // último 3: XXX + 00000 + XX
    expect(expandirUpcE('01234545')).toBe('012340000055');   // último 4: XXXX + 00000 + X
    expect(expandirUpcE('21234565')).toBeUndefined();   // sistema 2: no es UPC-E
    expect(codigoDeLectura('01234565', 'upc_e')).toBe('012345000065');
    expect(eanValido('012345000065')).toBe(true);
  });
  it('confirma el código solo cuando se lee igual en 2 cuadros; un cuadro vacío no reinicia; otro código sí', () => {
    const c = confirmadorDeLecturas(2);
    expect(c(['7441001639258'])).toBeUndefined();
    expect(c([])).toBeUndefined();
    expect(c([undefined])).toBeUndefined();
    expect(c(['7441001639258'])).toBe('7441001639258');
    const d = confirmadorDeLecturas(2);
    expect(d(['7441001639258'])).toBeUndefined();
    expect(d(['036000291452'])).toBeUndefined();   // otro código: vuelve a contar
    expect(d(['036000291452'])).toBe('036000291452');
  });
});
