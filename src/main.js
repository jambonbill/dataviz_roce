window.$ = window.jQuery = require('jquery');

require("bootstrap");
require('bootstrap-select');

var d3 = require("d3"),
    math_func = require('./math_func.js'),
    d3_sale_chromatic = require("d3-scale-chromatic");

// console.log(math_func);

// dev env #TODO: remove these lines
window.d3 = d3;
window.math_func = math_func;

$(document).ready(function () {
    var $loading_overlay = $("div.loading"),
        diagram_data = [],
        $graph_div = $("#graphDiv"),
        exchange_list = [],
        market_cap_list = [],
        region_list = [],
        sector_list = [],
        industry_dict = {},
        company_data, ROCE_data, graph_div_width, config, color_scale;


    // listeners
    $(window).resize(function () {
        var new_graph_div_width = $graph_div.width();
        if (new_graph_div_width !== graph_div_width) {
            plotDiagram(diagram_data);
            graph_div_width = new_graph_div_width;
        }
    });


    // load data
    d3.json('backend?item=company_list', function (error, data) {
        if (error) {
            company_data = false;
            console.error(error);
        } else {
            company_data = data['companies'];
        }
    });

    d3.json('backend?item=ROCE_list', function (error, data) {
        if (error) {
            ROCE_data = false;
            console.error(error);
        } else {
            ROCE_data = data['ROCEs'];
        }
    });

    $.get("config.json", function (data) {
        config = data;
        market_cap_list = config['market_caps'];
        region_list = config['regions'];
    }).fail(function (error) {
        config = false;
        console.error(error);
    });

    initOptions();

    // functions


    function initOptions() {
        // Is data ready?
        if (company_data && ROCE_data && config) {
            console.info("Initiating");

            // prepare company_data by inserting exchange value
            company_data = $.grep($.map(company_data, function (datum1) {
                // console.log(datum);
                var sector = datum1['sector'],
                    industry = datum1['industry'],
                    exchange = datum1['exchange'];

                if (!sector || !industry || sector === "n/a" || industry === "n/a") return false;

                if (exchange_list.indexOf(exchange) === -1) exchange_list.push(exchange);

                // fill sector_list, industry_list
                if (sector_list.indexOf(sector) === -1) sector_list.push(sector);
                industry_dict[industry] = sector;
                return datum1;
            }), function (datum) {
                return datum !== false;
            });

            // init exchange options
            $.each(exchange_list, function (i, exchange) {
                // console.log(exchange);
                $(".exchange").append(generateOptionElement(exchange, exchange));
            });

            // init market cap options
            $.each(market_cap_list, function (i, datum) {
                $(".cap").append(generateOptionElement(datum['name'], datum['range']));
            });

            region_list.sort(function (a, b) {
                return a['name'].length - b['name'].length;
            });
            // init region options
            $.each(region_list, function (i, datum) {
                $(".region").append(generateOptionElement(datum['name'], datum['countries']));
            });

            sector_list.sort(function (a, b) {
                return a.length - b.length;
            });
            // init sector options
            $.each(sector_list, function (i, sector_name) {
                $(".sector").append(generateOptionElement(sector_name, sector_name));
            });

            // init industry options
            $.each(industry_dict, function (industry_name, sector_name) {
                $(".industry select").append(
                    '<option value="' + industry_name + '" data-tokens="' + sector_name + " " + industry_name + '">' + industry_name + '</option>'
                );
            });
            $('.industry .selectpicker').selectpicker('refresh');

            // init color legend
            updateDiagramWrapper();

            /** add listeners **/
            // span click
            $("span.option").click(function () {
                $(this).toggleClass("selected");
                updateDiagramWrapper();
                updateClearAllButtons();
            });

            // legend select
            $("#color-legend-select").on('hidden.bs.select', function (e) {
                updateDiagramWrapper();
            });

            // clear all button
            $(".clear-button").click(function () {
                console.log(this);
                var $this = $(this);

                $this.closest(".option-wrapper").find("span").removeClass("selected");
                updateClearAllButtons();
            });


        } else if (company_data === false || ROCE_data === false || config === false) {
            // deal with load error
            alert("Something went wrong. See console log for details.");
        } else {
            return setTimeout(initOptions, 100);
        }
    }

    function updateClearAllButtons() {
        $(".option-wrapper").each(function () {
            var $wrapper = $(this);
            $wrapper.find(".clear-button").toggleClass("invisible", $wrapper.find('.option.selected').length === 0);
        });
    }

    function generateOptionElement(text, value) {
        return $("<span class='option'></span>").text(text).data('value', value)
            .prepend("<div class='color-legend-rect'></div>");
    }

    function updateDiagramWrapper() {
        updateColorLegend();
        updateDiagramData();
        plotDiagram();
    }

    function updateColorLegend() {
        var $wrapper;

        switch ($("#color-legend-select").val()) {
            case 'exchange':
                $wrapper = $(".exchange.option-wrapper");
                break;
            case 'sector':
                $wrapper = $(".sector.option-wrapper");
                break;
            case 'market_cap':
                $wrapper = $(".cap.option-wrapper");
                break;
            case 'region':
                $wrapper = $(".region.option-wrapper");
                break;
            default:
                return console.error("Unknown legend value") && false;
        }

        // manipulate class
        $(".option-wrapper").removeClass("on-legend");
        $wrapper.addClass("on-legend");

        // update color
        var $selected_options = $wrapper.find("span.option.selected");
        updateColorScale($selected_options.length);
        $selected_options.each(updateOptionLegendColor);
    }

    function updateDiagramData() {
        diagram_data = [];
        var count_per_category = Math.round(Math.random() * 3 + 3);
        var categories = $(".option-wrapper.on-legend .option.selected").map(function () {
            return $(this).data('value');
        });


        $.each(categories, function (ii, v) {
            for (var jj = 0; jj < count_per_category; jj++) {
                diagram_data.push({tr: Math.random() * 10, mg: Math.random() * 10, category_index: ii});
            }
        });
    }

    function updateColorScale(color_count) {
        if (color_count > 12) {
            color_scale = d3.scaleOrdinal(d3.schemeCategory20);
        } else if (color_count > 10) {
            color_scale = d3.scaleOrdinal(d3_sale_chromatic.schemePaired);
        } else {
            color_scale = d3.scaleOrdinal(d3.schemeCategory10);
        }
    }

    function updateOptionLegendColor(option_index) {
        var $this = $(this);
        var color = color_scale(option_index);
        $this.find(".color-legend-rect").css({background: color});
    }


    function calculateVariations(retry_count) {
    }


    function showLoading(to_show) {
        var is_hidden_now = $loading_overlay.is(":hidden");

        if (to_show && is_hidden_now) {
            $loading_overlay.show();
        } else if (!to_show && !is_hidden_now) {
            $loading_overlay.hide();
        }
    }


    /**********************
     * Math Calculation
     */


    /****** Initiate ******/
    var outer_width, width, x, y,
        outer_height = 400,
        margin = {top: 20, right: 20, bottom: 30, left: 50},
        height = outer_height - margin.top - margin.bottom,
        dot_radius = 4; //pixels


    // append svg
    var svg = d3.select("#graphDiv svg"),
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add Axis
    g.append("g").attr("class", "grid x-grid");
    g.append("g").attr("class", "grid y-grid");
    g.append("g").attr("class", "axis x-axis").attr("transform", "translate(0," + height + ")");
    g.append("g").attr("class", "axis y-axis");

    /**** Initiated ****/

    function plotDiagram() {
        if (!diagram_data) {
            return false;
        }
        console.info(Date.now() % 100000, "Ploting data");
        var outer_div_width = $graph_div.width();
        outer_width = Math.min(Math.max(outer_div_width, 500), 700);

        width = outer_width - margin.left - margin.right;
        x = d3.scaleLinear().range([0, width]);
        y = d3.scaleLinear().range([height, 0]);

        // console.log(data);
        // g.selectAll("circle").remove();

        // update svg
        svg.attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style("margin-left", ($("div.container").width() - outer_width) / 2);

        x.domain([0, d3.max(diagram_data, function (d) {
            return d['tr'];
        })]);
        y.domain([0, d3.max(diagram_data, function (d) {
            return d['mg'];
        })]);

        var t = d3.transition()
            .duration(350);

        // update grid lines
        g.select(".x-grid")
            .transition(t)
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x).ticks().tickSize(-height).tickFormat(""));

        g.select(".y-grid")
            .transition(t)
            .call(d3.axisLeft(y).ticks().tickSize(-width).tickFormat(""));

        // Update the scatterplot
        var dots = g.selectAll("circle").data(diagram_data);

        dots.exit()
            .classed("exit", true)
            .transition(t)
            .attr("r", dot_radius * 5)
            .style("fill-opacity", 1e-6)
            .remove();

        dots.classed("update", true)
            .attr("fill", function (d) {
                return color_scale(d['category_index']);
            });

        dots.enter().append("circle")
            .attr("r", dot_radius)
            .attr("class", "dot")
            .merge(dots)
            .on("mouseover", function (d) {
                var $tooltip = $("#tooltip");
                var tooltip_left = parseFloat(d3.select(this).attr("cx")) + $graph_div.position()['left']
                    + $tooltip.width() / 2 + 72 + parseFloat($graph_div.find("svg").css("margin-left"));
                var tooltip_top = parseFloat(d3.select(this).attr("cy")) + $graph_div.position()['top']
                    - $tooltip.height() / 2 - 73;

                if (tooltip_left > width - 100) {
                    // might exceed right side of screen, switch to left
                    tooltip_left -= 179;
                }

                // handle dot
                d3.select(this).attr("r", dot_radius * 2.5).classed("hover", true);

                // handle tooltip
                var tooltip = d3.select("#tooltip")
                    .style("left", tooltip_left + "px")
                    .style("top", tooltip_top + "px")
                    .classed("hidden", false);

            })
            .on("mouseout", function () {
                // handle dot
                d3.select(this).attr("r", dot_radius).classed("hover", false);

                // hide tooltip
                d3.select("#tooltip").classed("hidden", true);
            })
            .transition(t)
            .attr("cx", function (d) {
                return x(d['tr']);
            })
            .attr("cy", function (d) {
                return y(d['mg']);
            })
            .attr("fill", function (d) {
                return color_scale(d['category_index']);
            });

        // Update Axis
        g.select(".x-axis")
            .transition(t)
            .call(d3.axisBottom(x));

        g.select(".y-axis")
            .transition(t)
            .call(d3.axisLeft(y));
    }
});
