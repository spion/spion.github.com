---
title: "COVID-19: Can you really compare the UK to Sweden?"
description: "No, not really"
date: 2020-09-05
layout: post.pug
hidden: true
---

**EDIT: This article contained a mistake in the calculations. As a result, I had to rewrite the whole thing again, and the rewrite is available at [this link](/posts/uk-sweden-growth/). Some of the conclusions are different, but the gist should be largely the same.**

Sweden is a hot topic lately, with many people giving them as an example. A lot of people are trying
to compare Sweden with the UK. Lets see why this comparison is inadequate as the countries were
behaving very differently before any lockdown or mass measures were introduced.

Lets load up both countries stats from ourworldindata


```python
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime

plt.rcParams['figure.dpi'] = 120
plt.rcParams['figure.figsize'] = [6.0, 4.0]
dateparse = lambda x: datetime.strptime(x, '%Y-%m-%d')
owid_url = 'https://covid.ourworldindata.org/data/owid-covid-data.csv'
owid = pd.read_csv(owid_url, parse_dates=['date'], date_parser=dateparse)
```

We can get the countries data by their ISO code


```python
uk = owid[owid.iso_code.eq("GBR")]
sweden = owid[owid.iso_code.eq("SWE")]
```

Now lets compare deaths. To avoid problems with small data, we'll start the comparison when both countries deaths go above 5 per day. We're using the weekly moving average column from ourworldindata in order to get a better sense of the trend.


```python
gbrmarch = uk.loc[(owid['date'] > '03-15-2020') & (owid['date'] <= '04-15-2020')];
swemarch = sweden.loc[(owid['date'] > '03-22-2020') & (owid['date'] <= '04-22-2020')];

gbr1 = gbrmarch.reset_index().rename(columns={'new_deaths_smoothed': 'UK Mar-Apr'})['UK Mar-Apr']
swe1 = swemarch.reset_index().rename(columns={'new_deaths_smoothed': 'Sweden Apr'})['Sweden Apr']

plt = pd.concat([gbr1, swe1], axis=1).plot(grid=True)
```


![png](/posts/output_5_0.png)


Okay, so it looks like the deaths in the UK were growing faster than the deaths in Sweden from the very beginning! Lets look at the growth rate with period 5 days, that should track R_t closely:


```python
gbr1growth = gbr1.pct_change(periods=5)
gbr1growth = gbr1growth + 1
swe1growth = swe1.pct_change(periods=5)
swe1growth = swe1growth + 1
plt = pd.concat([gbr1growth, swe1growth], axis=1).plot(grid=True)
```


![png](/posts/output_7_0.png)


It looks like the rate of growth was higher in the UK from the very start and remained higher throughout the first month. Now lets try and extrapolate what was going on in terms of cases that produced these deaths.

The mean time from infection to death for patients with fatal outcomes is 21 days. This means that the dates where we observe these rates of growth begin on 23rd February in the UK and around 1st of March in Sweden. Point 10 in the plot is therefore March 2nd in the UK, March 9th in Sweden.

So what happened between March 2nd and March 8th in the UK, where the rate of growth seemed to have been between 3.0 and 4.0 ?

And what happened in Sweden?

### UK: Contact tracing

At the time, contact tracing seemed like a reasonably good strategy. It was thought that South Korea has been very successful due to this approach. Assuming you have enough capacity, you should be able to find everyone in contact with the infected person, and also their contacts and so on.

Unfortunately this didn't pan out as planned. The virus quickly entered the community spread phase. PHE gave up on contact tracing due to being overwhelmed on March 11th - that would be somewhere after day 20 on the chart. Growth rate was still very high, above 2.0. No measures were in place at that time.


### Sweden: Mass measures

It seems like Sweden did quite a few things early on:

* Feb 27th: Almega, the largest organization of service companies in Sweden advised employees to stay at home if they visited high risk areas
* March 3rd: The Scandinavian airline SAS stopped all flights to northern Italy
* March 11: The government announced that the qualifying day of sickness ('karensdag') will be temporarily abolished in order to ensure that people feeling slightly ill will stay at home from work. This means that the state will pay sick pay allowance from the first day the employee is absent from work


These measures are what happened on paper. Its much better to look at how people really reacted by looking at google mobility trends


```python
dateparse = lambda x: datetime.strptime(x, '%b %d, %Y')
mobility = pd.read_csv('https://drive.google.com/u/0/uc?id=1M4GY_K4y6KZtkDtz7i12fhs8LeyUTyaK&export=download', parse_dates=['Date'], date_parser=dateparse)
```


```python
def plot_item(name):

    swemob = mobility[mobility.Code.eq("SWE")]
    gbrmob = mobility[mobility.Code.eq("GBR")]

    gbrmobmarch = gbrmob.loc[(mobility['Date'] > '02-23-2020') & (mobility['Date'] <= '03-23-2020')];
    swemobmarch = swemob.loc[(mobility['Date'] > '03-01-2020') & (mobility['Date'] <= '04-01-2020')];

    gbrM1 = gbrmobmarch.reset_index().rename(columns={''+name: 'GBR ' + name})['GBR ' + name]
    sweM1 = swemobmarch.reset_index().rename(columns={''+name: 'SWE ' + name})['SWE ' + name]
    plt = pd.concat([gbrM1, sweM1], axis=1).plot(grid=True)
```


```python
plot_item('Workplaces (%)')
plot_item('Residential (%)')
plot_item('Transit Stations (%)')
```


![png](/posts/output_11_0.png)



![png](/posts/output_11_1.png)



![png](/posts/output_11_2.png)


Looks like the people in Sweden reacted to the pandemic 10 days earlier than the UK did. Perhaps thats how they curbed the spread? Either way, the important point is that the rate of growth makes the biggest difference early on and any quick actions to reduce it are of much greater value than delayed ones.

Regardless, its still wrong to compare UK with Sweden when the rates of growth are different. To show why, I will use a car analogy

### The car analogy

Lets say we have two car models from the same company, World Cars. World cars are a bit quirky, they like to name their cars by countries in the world. We would like to decide which one to buy and one of the factors we're interested in is safety. Specifically, we want to know how well the brakes work.

To determine which car is better, we try to look up at some data on braking tests. We find the
following two datapoints for the cars:

| Car name | Brake distance |
|----------|----------------|
| UK       | 32 m           |
| Sweden   | 30 m           |

Oh, nice. It looks like the brakes are pretty similar, with Sweden's being slightly better.

But then you notice something odd about these two tests. It looks like they were performed at
different initial speeds!

| Car name | Brake distance | Initial speed |
|----------|----------------|---------------|
| UK       | 32 m           | 80 km/h       |
| Sweden   | 30 m           | 40 km/h       |

Wait a minute. This comparison makes no sense now! In fact its quite likely that the UK car brakes are way more effective,  being able to stop in just 32m from a starting speed of 80 km/h. A little [back of the napkin](https://www.johannes-strommer.com/diverses/pages-in-english/stopping-distance-acceleration-speed/) math shows that UK's brake distance for an initial speed of 40 km/h would be just 8 meters:

| Car name | Brake distance | Initial speed |
|----------|----------------|---------------|
| UK       | 8 m            | 40 km/h       |
| Sweden   | 30 m           | 40 km/h       |

Now lets look at the rate of growth chart for daily deaths again:

![png](/posts/output_7_0.png)

Just as we can't compare the effectiveness of brakes by the distance traveled if the initial speed
is different, we can't compare the effectiveness of measures by the number of cases per million if
the initial rate of growth was different. Different rate of growth means that different brakes are
needed.

> Note: with cases its probably even worse as exponential (and near-exponential) growth is far more
dramatic than the quadratic growth caused by acceleration
