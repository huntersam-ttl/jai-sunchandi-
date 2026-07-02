import nepali_datetime
from datetime import date, datetime

GRAMS_PER_TOLA = 11.664
PURITY_FACTORS = {"24K": 1.0, "22K": 0.916, "18K": 0.75, "silver": 1.0}
NEP_DIGITS = str.maketrans("0123456789", "०१२३४५६७८९")
BS_MONTHS = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"]


def to_nepali_digits(value) -> str:
    return str(value).translate(NEP_DIGITS)


def ad_to_bs(ad_date) -> dict:
    if isinstance(ad_date, str):
        ad_date = datetime.fromisoformat(ad_date.replace("Z", "+00:00")).date() if "T" in ad_date else date.fromisoformat(ad_date)
    elif isinstance(ad_date, datetime):
        ad_date = ad_date.date()
    bs = nepali_datetime.date.from_datetime_date(ad_date)
    iso = f"{bs.year:04d}-{bs.month:02d}-{bs.day:02d}"
    long = f"{bs.day} {BS_MONTHS[bs.month - 1]} {bs.year}"
    return {"bs_date": iso, "bs_date_np": to_nepali_digits(iso), "bs_date_long_np": to_nepali_digits(long)}


def grams_to_tola(grams: float) -> float:
    return round(grams / GRAMS_PER_TOLA, 4)


def tola_lal_aana_to_grams(tola: float = 0, lal: float = 0, aana: float = 0) -> float:
    total_tola = tola + (aana / 16.0) + (lal / 100.0)
    return round(total_tola * GRAMS_PER_TOLA, 3)


def compute_price(weight_grams, rate_per_tola, purity, jarti_percent=0, jyala_amount=0,
                  jyala_type="flat", stone_cost=0, polishing_cost=0, cutting_cost=0,
                  worker_charge=0, other_cost=0, discount=0):
    tola = weight_grams / GRAMS_PER_TOLA
    factor = PURITY_FACTORS.get(purity, 1.0)
    metal_value = tola * rate_per_tola * factor
    jarti = metal_value * (jarti_percent / 100.0)
    jyala = jyala_amount * tola if jyala_type == "per_tola" else jyala_amount
    total = metal_value + jarti + jyala + stone_cost + polishing_cost + cutting_cost + worker_charge + other_cost - discount
    return {
        "weight_grams": round(weight_grams, 3),
        "weight_tola": round(tola, 4),
        "rate_per_tola": rate_per_tola,
        "purity": purity,
        "purity_factor": factor,
        "metal_value": round(metal_value, 2),
        "jarti_percent": jarti_percent,
        "jarti_amount": round(jarti, 2),
        "jyala_type": jyala_type,
        "jyala_input": jyala_amount,
        "jyala_amount": round(jyala, 2),
        "stone_cost": stone_cost,
        "polishing_cost": polishing_cost,
        "cutting_cost": cutting_cost,
        "worker_charge": worker_charge,
        "other_cost": other_cost,
        "discount": discount,
        "total_price": round(total, 2),
    }


def mask_name(name: str) -> str:
    parts = (name or "").split()
    return " ".join(p[0] + "*" * (len(p) - 1) if len(p) > 1 else p for p in parts)
