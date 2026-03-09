This project uses ENTSO-e data to simulate the management of a Hydroelectric power plant in Switzerland. Power prices and hypothetical profits are updated daily. Daily inflow is roughly based on the Léman lake monthly levels for 2023.
---
***Live Version***

v1.01 (9/3/26) Now the model maximizes profite while keeping reservoir levels at or above original levels. Linear optimization is processed through the pulp package. 

Possible misinterpretation: Reservoir Trend not matching the graph happens because the natural inflow in the first hour is already taken into account so it shows a slightly higher number than the initial reservoir level.
---
***Future updates***

-Might include quarter-hour behaviour, cooldown to improve realism and functionality.

-Might upgrade to a time series prediction for the price to estimate the schedule, formulate the model and contrast it with actual prices for profit measuring.