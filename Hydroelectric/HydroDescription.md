This project uses ENTSO-e data to simulate the management of a Hydroelectric power plant in Switzerland. Power prices and hypothetical profits are updated daily. Daily inflow is roughly based on the Léman lake monthly levels for 2023.
---
***Live Version***

v1.0 (15/2/26) Currently, the application forces pumping in the 4 cheapest hours of the day and dumping in the 4 most expensive hours. No other constraints are in place.
---
***Future updates***

-Will soon upgrade the profit logic to mantain reservoir levels while maximizing profit, considering bigger dumping/pumping schedules.

-Might upgrade to a time series prediction for the price to estimate the schedule, formulate the model and contrast it with actual prices for profit measuring.