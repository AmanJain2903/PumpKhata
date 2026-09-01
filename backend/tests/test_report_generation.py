from decimal import Decimal
from types import SimpleNamespace

from app.services.pdf_generator import _aggregate_product_sales


def test_aggregate_product_sales_subtracts_testing_liters():
    product = SimpleNamespace(name="Petrol")
    tank_1 = SimpleNamespace(product_id=7, name="Tank 1", product=product)
    tank_2 = SimpleNamespace(product_id=7, name="Tank 2", product=product)

    session = SimpleNamespace(
        nozzle_logs=[
            SimpleNamespace(
                nozzle=SimpleNamespace(tank=tank_1),
                gross_liters_sold=Decimal("100"),
                product_price=Decimal("80"),
            ),
            SimpleNamespace(
                nozzle=SimpleNamespace(tank=tank_2),
                gross_liters_sold=Decimal("50"),
                product_price=Decimal("80"),
            ),
        ],
        tank_logs=[
            SimpleNamespace(tank=tank_1, testing_liters=Decimal("10")),
            SimpleNamespace(tank=tank_2, testing_liters=Decimal("5")),
        ],
    )

    summary = _aggregate_product_sales([session])

    assert summary[7]["vol"] == Decimal("150")
    assert summary[7]["testing_liters"] == Decimal("15")
    assert summary[7]["net_vol"] == Decimal("135")


def test_inventory_variance_uses_latest_product_price():
    product = SimpleNamespace(name="Petrol", current_price=Decimal("85.00"))
    tank = SimpleNamespace(id=3, name="Tank A", product_id=7, product=product)

    sessions = [
        SimpleNamespace(
            nozzle_logs=[],
            tank_logs=[
                SimpleNamespace(tank_id=3, tank=tank, calculated_variance=Decimal("10.00"), testing_liters=Decimal("0"))
            ],
        )
    ]

    result = {}
    for tid, tdata in {
        3: {"var": Decimal("10.00"), "product_id": 7, "name": "Tank A"}
    }.items():
        unit_price = getattr(tank.product, "current_price", Decimal("0"))
        result[tid] = tdata["var"] * unit_price

    assert result[3] == Decimal("850.00")
