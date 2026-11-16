"""Configuración por variables de entorno. Nada secreto: este servicio no usa claves."""
import ipaddress
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

API = Path(__file__).resolve().parents[1]
PROTOTIPO = API.parent
COSTA_RICA = timezone(timedelta(hours=-6))   # UTC−6, sin horario de verano desde 1992


def hoy_costa_rica(ahora: datetime | None = None) -> date:
    """Fecha de Costa Rica, no la del contenedor (UTC). Con UTC la semana cerraba el domingo a las 18:00 de aquí y el
    límite de 90 días se corría un día (auditoría P-09)."""
    return (ahora or datetime.now(timezone.utc)).astimezone(COSTA_RICA).date()


@dataclass(frozen=True)
class Config:
    base_productos: Path = PROTOTIPO / 'web' / 'public' / 'datos' / 'productos_cr.json'
    bd: str = str(API / 'datos' / 'precios.sqlite3')
    origenes: tuple[str, ...] = ('http://localhost:5173', 'http://localhost:4173')
    min_reportes: int = 3          # k-anonimato: un grupo de precios se publica con 3 aportes o más (SUPUESTO)
    semanas: int = 12              # ventana de la tabla de precios
    dias_atras: int = 90           # un aporte puede ser de una compra de hasta 90 días atrás
    limite_por_hora: int = 120     # filas (precios o reportes) por cliente por hora
    max_lote: int = 60             # precios por envío (un tiquete grande)
    max_cuerpo: int = 64 * 1024    # bytes por petición POST
    confiar_proxy: bool = False    # usar X-Forwarded-For solo detrás de un proxy propio
    proxies: tuple[str, ...] = ()  # IP o CIDR del proxy: X-Forwarded-For solo se cree si la conexión viene de ahí (P-10)
    docs: bool = True              # /docs carga scripts de cdn.jsdelivr.net: apagado en producción (P-07)
    hoy: Callable[[], date] = field(default=hoy_costa_rica)

    def __post_init__(self):
        # D-17: k-anonimato con 3 aportes o más. Un valor menor por error publicaría precios de una sola compra (H-07).
        if self.min_reportes < 3:
            raise ValueError('CANASTA_MIN_REPORTES debe ser 3 o más (D-17)')
        # P-12: «http://localhost:5173/» no coincide con la cabecera Origin (que nunca lleva «/») y CORS fallaba sin aviso.
        object.__setattr__(self, 'origenes', tuple(o.strip().rstrip('/') for o in self.origenes if o.strip()))
        for p in self.proxies:
            ipaddress.ip_network(p, strict=False)   # un valor mal escrito detiene el arranque, no se ignora

    @staticmethod
    def desde_entorno() -> 'Config':
        c = Config()
        e = os.environ
        return Config(
            base_productos=Path(e.get('CANASTA_BASE', c.base_productos)),
            bd=e.get('CANASTA_BD', c.bd),
            origenes=tuple(o.strip() for o in e['CANASTA_ORIGENES'].split(',') if o.strip())
            if 'CANASTA_ORIGENES' in e else c.origenes,
            min_reportes=int(e.get('CANASTA_MIN_REPORTES', c.min_reportes)),
            limite_por_hora=int(e.get('CANASTA_LIMITE_HORA', c.limite_por_hora)),
            confiar_proxy=e.get('CANASTA_CONFIAR_PROXY', '0') == '1',
            proxies=tuple(p.strip() for p in e.get('CANASTA_PROXIES', '').split(',') if p.strip()),
            docs=e.get('CANASTA_DOCS', '1') != '0',
        )
