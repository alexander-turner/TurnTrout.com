# This is a test file for developing residual magnitude plots

# %%
import pandas as pd
from dash import Dash, ctx, dcc, html, Input, Output, callback
import plotly.express as px
import plotly.graph_objects as go
import numpy as np

# %%

import plotly.express as px
import plotly.graph_objects as go
import numpy as np

# %%


def magnitude_histogram(df: pd.DataFrame, cols='all', title="Residual Stream Magnitude by Layer Number",
    xaxis_title="log10 Residual Stream norm", yaxis_title="Percentage of residual streams") -> go.Figure:
    """Plot a histogram of the residual stream magnitudes for each layer
    of the network."""
    assert (
        "Magnitude" in df.columns
    ), "Dataframe must have a 'Magnitude' column"

    # Get the number of unique activation locations
    num_unique_activation_locations = df["Activation Location"].nunique()

    # Generate a color list that is long enough to accommodate all unique activation locations
    extended_rainbow = (
        px.colors.sequential.Rainbow * num_unique_activation_locations
    )
    color_list = extended_rainbow[:num_unique_activation_locations][::-1]

    if cols != 'all':
        unique_cols = list(df["Activation Location"].unique())
        # get indices in unique_cols of values in cols
        cols_colors = [unique_cols.index(col) for col in cols]
        color_list = [color_list[i] for i in cols_colors]
        df = df[df["Activation Location"].isin(cols)]

    df["LogMagnitude"] = np.log10(df["Magnitude"])


    fig = px.histogram(
        df,
        x="LogMagnitude",
        color="Activation Location",
        marginal="rug",
        histnorm="percent",
        nbins=100,
        opacity=0.5,
        barmode="overlay",
        color_discrete_sequence=color_list,
    )

    fig.update_layout(
        legend_title_text="Before Layer Index",
        title=title,
        xaxis_title=xaxis_title,
        yaxis_title=yaxis_title,
    )

    return fig

# %%

# set working directory to project root
import os
os.chdir('../..')
df = pd.read_csv('scripts/plots/fig1.csv')
fig = magnitude_histogram(df)
# fig.show()

# %%

app = Dash(__name__)

app.layout = html.Div(
    [
        dcc.Graph(figure=fig, id='magnitude-histogram'),
        dcc.Checklist(["Show all layers"], id='all-layers-checklist', value=['Show all layers']),
        html.Label("Choose a layer"),
        dcc.Slider(5, 45, 5,
               value=5,
               id='my-slider'
        ),  
        html.Div(id='slider-output-container'),
    ]
)

@callback(
    Output('magnitude-histogram', 'figure'),
    Input('my-slider', 'value'),
    Input('all-layers-checklist', 'value'))
def update_output(slider_value, checklist_value):
    if ctx.triggered_id == 'my-slider':
        return magnitude_histogram(df, cols=[slider_value])
    else:
        return magnitude_histogram(df, cols='all')

@callback(
    Output('all-layers-checklist', 'value'),
    Input('my-slider', 'value'))
def update_checklist(value):
    return []

if __name__ == '__main__':
    app.run(debug=True, port='8052')

print(app.scripts.config.serve_locally)

# %%